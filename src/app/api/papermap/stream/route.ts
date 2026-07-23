import { GoogleGenerativeAI } from '@/lib/google-ai-proxy';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { mindmaps, mindmapNodes } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { jsonrepair } from "jsonrepair";
import { eq } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Initialize Google AI services
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Prompt for quick overview (root + level 1 only)
const QUICK_OVERVIEW_PROMPT = `You are a specialized AI assistant that creates structured mindmaps.

Create a QUICK OVERVIEW mindmap with ONLY the root node and its immediate children (level 0 and level 1).
DO NOT create deeper levels - those will be added later.

JSON Structure:
{
  "nodes": [
    {"id": "unique-id", "title": "node title", "description": "brief description", "parentId": null, "level": 0, "pageNumber": 1},
    {"id": "unique-id-2", "title": "subtopic", "description": "brief description", "parentId": "parent-id", "level": 1, "pageNumber": 2}
  ]
}

Requirements:
- EXACTLY ONE root node with level=0 and parentId=null
- 3-5 level-1 children that cover the main topics
- Keep descriptions concise (1-2 sentences max)
- Use MARKDOWN formatting (**bold**, *italics*)
- Include pageNumber for each node

ONLY output valid JSON. No additional text.`;

// Prompt for expanding a specific node
const EXPAND_NODE_PROMPT = `You are a specialized AI assistant that expands mindmap nodes.

Given a parent node, create 2-4 child nodes that expand on the topic.

JSON Structure:
{
  "nodes": [
    {"id": "unique-id", "title": "node title", "description": "detailed description", "parentId": "PARENT_ID", "level": PARENT_LEVEL_PLUS_1, "pageNumber": 1}
  ]
}

Requirements:
- All nodes must have parentId set to the given parent node ID
- All nodes must have level = parent level + 1
- Keep descriptions informative but concise
- Use MARKDOWN formatting (**bold**, *italics*)
- Include relevant pageNumber if applicable

ONLY output valid JSON. No additional text.`;

interface StreamMessage {
    type: 'overview' | 'expansion' | 'complete' | 'error';
    nodes?: any[];
    mindmapId?: string;
    parentNodeId?: string;
    error?: string;
}

function createSSEMessage(data: StreamMessage): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Streaming API endpoint for progressive mindmap generation
 * Uses Server-Sent Events (SSE) to stream nodes as they're generated
 */
export async function POST(request: NextRequest) {
    // Verify Gemini API key is configured
    if (!process.env.GOOGLE_API_KEY) {
        return new Response(
            createSSEMessage({ type: 'error', error: 'GOOGLE_API_KEY is not configured' }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                }
            }
        );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
        return new Response(
            createSSEMessage({ type: 'error', error: 'Unauthorized user' }),
            {
                status: 401,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                }
            }
        );
    }
    const userId: string = user.id;

    const encoder = new TextEncoder();

    // Create a TransformStream for SSE
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start processing in the background
    (async () => {
        try {
            const data = await request.json();
            const { blobUrl, textInput, sourceUrl, originalFileName } = data;

            // Initialize Gemini API
            const model = genAI.getGenerativeModel({
                model: process.env.PAPERMAP_STREAM_MODEL || "gemini-2.5-flash",
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 4096, // Smaller for faster response
                    responseMimeType: "application/json"
                }
            });

            // Generate mindmap ID upfront
            const mindmapId = uuidv4();

            // Determine input type
            let inputType: 'pdf' | 'text' | 'url' = 'text';
            if (blobUrl && !textInput) {
                inputType = originalFileName ? 'pdf' : 'url';
            } else if (textInput && sourceUrl) {
                inputType = 'url';
            }

            // === PHASE 1: Quick Overview ===
            let overviewPrompt: string;
            let messageParts: any[] = [];

            if (textInput && sourceUrl) {
                overviewPrompt = `${QUICK_OVERVIEW_PROMPT}\n\nCreate a quick overview mindmap for this web content:\n\n"${textInput.substring(0, 5000)}"\n\nSource: ${sourceUrl}`;
                messageParts = [{ text: overviewPrompt }];
            } else if (textInput) {
                overviewPrompt = `${QUICK_OVERVIEW_PROMPT}\n\nCreate a quick overview mindmap for this topic:\n\n"${textInput}"`;
                messageParts = [{ text: overviewPrompt }];
            } else if (blobUrl) {
                overviewPrompt = `${QUICK_OVERVIEW_PROMPT}\n\nAnalyze this PDF and create a quick overview mindmap with just the main topics.`;

                if (blobUrl.includes('vercel-blob.com')) {
                    messageParts = [
                        { text: overviewPrompt },
                        { fileData: { mimeType: "application/pdf", fileUri: blobUrl } }
                    ];
                } else {
                    // Fetch and convert to base64 for non-Vercel URLs
                    const pdfResponse = await fetch(blobUrl);
                    if (!pdfResponse.ok) {
                        throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
                    }
                    const pdfBuffer = await pdfResponse.arrayBuffer();
                    const base64Data = Buffer.from(pdfBuffer).toString('base64');
                    messageParts = [
                        { text: overviewPrompt },
                        { inlineData: { mimeType: "application/pdf", data: base64Data } }
                    ];
                }
            } else {
                throw new Error('No valid input provided');
            }

            // Start chat for overview
            const chat = model.startChat({
                history: [
                    { role: "user", parts: [{ text: "You are a mindmap generator. Always respond with valid JSON only." }] },
                    { role: "model", parts: [{ text: "Understood. I will only respond with valid JSON for mindmap generation." }] }
                ],
                generationConfig: { responseMimeType: "application/json" }
            });

            // Generate overview
            const overviewResponse = await chat.sendMessage(messageParts);
            const overviewText = overviewResponse.response.text();

            // Parse overview response
            let overviewData: { nodes: any[] };
            try {
                overviewData = JSON.parse(overviewText);
            } catch {
                overviewData = JSON.parse(jsonrepair(overviewText));
            }

            if (!overviewData.nodes || !Array.isArray(overviewData.nodes)) {
                throw new Error('Invalid overview response format');
            }

            // Find root node and get title
            const rootNode = overviewData.nodes.find((n: any) => n.parentId === null);
            const title = rootNode ? rootNode.title : 'Untitled Mindmap';

            // Save mindmap to database
            const now = new Date();
            await db.insert(mindmaps).values({
                id: mindmapId,
                title,
                inputType,
                pdfUrl: blobUrl || null,
                fileName: originalFileName || title,
                sourceUrl: sourceUrl || null,
                createdAt: now,
                updatedAt: now,
                userId,
            });

            // Save overview nodes
            const overviewNodeInserts = overviewData.nodes.map((node: any) => ({
                mindmapId,
                nodeId: node.id,
                title: node.title,
                description: node.description,
                parentId: node.parentId,
                level: node.level,
                pageNumber: node.pageNumber ?? null,
            }));

            if (overviewNodeInserts.length > 0) {
                await db.insert(mindmapNodes).values(overviewNodeInserts);
            }

            // Send overview to client
            await writer.write(encoder.encode(createSSEMessage({
                type: 'overview',
                nodes: overviewData.nodes,
                mindmapId
            })));

            // === PHASE 2: Progressive Expansion ===
            // Get level-1 nodes to expand
            const level1Nodes = overviewData.nodes.filter((n: any) => n.level === 1);

            // Expand each level-1 node (sequentially to avoid rate limits)
            for (const parentNode of level1Nodes) {
                try {
                    const expandPrompt = `${EXPAND_NODE_PROMPT}

Parent Node:
- ID: ${parentNode.id}
- Title: ${parentNode.title}
- Description: ${parentNode.description}
- Level: ${parentNode.level}

Create 2-3 child nodes (level ${parentNode.level + 1}) that expand on this topic.`;

                    const expandResponse = await chat.sendMessage([{ text: expandPrompt }]);
                    const expandText = expandResponse.response.text();

                    let expandData: { nodes: any[] };
                    try {
                        expandData = JSON.parse(expandText);
                    } catch {
                        expandData = JSON.parse(jsonrepair(expandText));
                    }

                    if (expandData.nodes && Array.isArray(expandData.nodes) && expandData.nodes.length > 0) {
                        // Ensure all nodes have correct parentId and level
                        const validatedNodes = expandData.nodes.map((node: any) => ({
                            ...node,
                            parentId: parentNode.id,
                            level: parentNode.level + 1
                        }));

                        // Save expanded nodes to database
                        const expandNodeInserts = validatedNodes.map((node: any) => ({
                            mindmapId,
                            nodeId: node.id,
                            title: node.title,
                            description: node.description,
                            parentId: node.parentId,
                            level: node.level,
                            pageNumber: node.pageNumber ?? null,
                        }));

                        if (expandNodeInserts.length > 0) {
                            await db.insert(mindmapNodes).values(expandNodeInserts);
                        }

                        // Send expansion to client
                        await writer.write(encoder.encode(createSSEMessage({
                            type: 'expansion',
                            nodes: validatedNodes,
                            parentNodeId: parentNode.id
                        })));
                    }
                } catch (expandError) {
                    console.error(`Failed to expand node ${parentNode.id}:`, expandError);
                    // Continue with other nodes even if one fails
                }
            }

            // Send completion message
            await writer.write(encoder.encode(createSSEMessage({
                type: 'complete',
                mindmapId
            })));

            // Fire-and-forget: Fetch Jina content for PDF
            if (blobUrl && (inputType === 'pdf' || inputType === 'url')) {
                fetchPdfMarkdownAndUpdateDb(mindmapId, blobUrl).catch(err => {
                    console.error('[Background] Jina fetch failed:', err);
                });
            }

        } catch (error) {
            console.error('Streaming error:', error);
            await writer.write(encoder.encode(createSSEMessage({
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            })));
        } finally {
            await writer.close();
        }
    })();

    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

// Helper function to fetch PDF markdown from Jina (copied from main route)
async function fetchPdfMarkdownAndUpdateDb(mindmapId: string, pdfUrl: string) {
    try {
        const jinaReaderApiUrl = `https://r.jina.ai/${encodeURIComponent(pdfUrl)}`;
        console.log(`[Background] Fetching PDF content from Jina Reader for mindmap ${mindmapId}`);

        const jinaResponse = await fetch(jinaReaderApiUrl, {
            headers: { "Accept": "text/markdown, text/plain;q=0.9, */*;q=0.8" }
        });

        if (jinaResponse.ok) {
            const parsedPdfMarkdown = await jinaResponse.text();
            const sanitizedMarkdown = parsedPdfMarkdown.replace(/\0/g, '');

            await db.update(mindmaps)
                .set({ parsed_pdf_content: sanitizedMarkdown, updatedAt: new Date() })
                .where(eq(mindmaps.id, mindmapId));

            console.log(`[Background] Successfully updated mindmap ${mindmapId} with parsed PDF content.`);
        } else {
            console.warn(`[Background] Jina Reader failed for mindmap ${mindmapId}: ${jinaResponse.status}`);
        }
    } catch (jinaError: any) {
        console.error(`[Background] Jina error for mindmap ${mindmapId}:`, jinaError.message);
    }
}
