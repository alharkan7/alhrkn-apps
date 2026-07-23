import { GoogleGenerativeAI } from '@/lib/google-ai-proxy';
import { NextRequest, NextResponse } from 'next/server';
// Import the sample text
import { EXAMPLE_PDF_TEXT } from '@/app/papermap/data/sampleMindmap';
import { db } from '@/db';
import { mindmaps, mindmapNodes } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { jsonrepair } from "jsonrepair";
import { MindmapSchema, AnswerSchema } from "./schemas";
import { eq } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Initialize Google AI services
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Define system prompt that explains the response format requirements
const SYSTEM_PROMPT = `You are a specialized AI assistant that analyzes PDF documents and creates structured mindmaps.

For the FIRST message with a PDF, you will create a mindmap with this structure:
{
  "nodes": [
    {
      "id": "unique-id",
      "title": "node title",
      "description": "detailed description",
      "parentId": "parent-node-id or null for root",
      "level": 0,
      "pageNumber": 1
    }
  ]
}

For FOLLOW-UP questions about specific nodes, you will provide answers in this format:
{
  "answer": "your answer here"
}

USE MARKDOWN FORMATTING in all descriptions and answers to make the text visually more appealing. Use **bold**, *italics*, lists, and other markdown features to improve readability.

The client will use your responses to construct and update a visual mindmap. Ensure all JSON is valid and follows these exact schemas.

GIVE YOUR RESPONSE IN THE MAIN LANGUAGE OF THE FILE. For example, if the PDF is dominantly not in English, provide your response using that language instead of English. If there's no PDF, then give your response in English.`;

// Additional prompt for text-based input
const TEXT_INPUT_PROMPT = `You are a specialized AI assistant that creates structured mindmaps from questions, ideas, topics, or web content.

Create a mindmap with this structure:
{
  "nodes": [
    {
      "id": "unique-id",
      "title": "node title",
      "description": "detailed description",
      "parentId": "parent-node-id or null for root",
      "level": 0,
      "pageNumber": null
    }
  ]
}

For FOLLOW-UP questions about specific nodes, you will provide answers in this format:
{
  "answer": "your answer here"
}

USE MARKDOWN FORMATTING in all descriptions and answers to make the text visually more appealing. Use **bold**, *italics*, lists, and other markdown features to improve readability.

Structure Requirements:
- EXACTLY ONE root node with level=0 and parentId=null
- Every non-root node MUST have a parentId that matches an existing node's id
- Child nodes MUST have level = parent's level + 1
- IDs must be unique
- AIM FOR DEPTH: Create 2-3 levels of hierarchy (root + 2 levels of children)
- BREAK DOWN CONCEPTS: Each major topic should be broken down into sub-topics
- DETAILED BRANCHING: Important concepts should branch into 2-3 child nodes

Description Style Requirements:
- Use direct statements that clearly explain concepts
- Include specific examples and details where appropriate
- Structure information hierarchically and logically
- Break down complex topics into simpler components
- USE MARKDOWN FORMATTING in descriptions to improve readability

The client will use your responses to construct and update a visual mindmap. Ensure all JSON is valid and follows these exact schemas.`;

// Additional prompt for web content
const WEB_CONTENT_PROMPT = `You are a specialized AI assistant that creates structured mindmaps from web content.

Create a comprehensive mindmap from the provided web content with this structure:
{
  "nodes": [
    {
      "id": "unique-id",
      "title": "node title",
      "description": "detailed description",
      "parentId": "parent-node-id or null for root",
      "level": 0,
      "pageNumber": null
    }
  ]
}

Structure Requirements:
- EXACTLY ONE root node with level=0 and parentId=null that summarizes the entire content
- Every non-root node MUST have a parentId that matches an existing node's id
- Child nodes MUST have level = parent's level + 1
- IDs must be unique
- ORGANIZE BY TOPICS: Group related information from across the content into coherent sections
- MAINTAIN ORIGINAL STRUCTURE: Follow the content's inherent organization where possible
- INCLUDE KEY POINTS: Capture main arguments, evidence, and conclusions
- AIM FOR DEPTH: Create 2-3 levels of hierarchy (root + 2 levels of children)

Description Style Requirements:
- Use direct statements that clearly explain concepts
- Include specific data points, quotes, and statistics from the content
- Structure information hierarchically and logically
- Break down complex topics into simpler components
- USE MARKDOWN FORMATTING in descriptions to improve readability

USE MARKDOWN FORMATTING in all descriptions and answers to make the text visually more appealing. Use **bold**, *italics*, lists, and other markdown features to improve readability.

The client will use your responses to construct and update a visual mindmap. Ensure all JSON is valid and follows these exact schemas.`;

/**
 * Main API route for handling PDF analysis and follow-up questions
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Gemini API key is configured
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: "Unauthorized user" },
        { status: 401 }
      );
    }
    const userId: string = user.id;

    const data = await request.json();
    const { blobUrl, textInput, isFollowUp, question, nodeContext, chatHistory, sourceUrl, originalFileName } = data;

    // Log request parameters for debugging
    console.log("API Request params:", { 
      hasBlobUrl: !!blobUrl, 
      hasTextInput: !!textInput, 
      isFollowUp,
      hasSourceUrl: !!sourceUrl,
      originalFileName,
      blobUrlType: blobUrl ? typeof blobUrl : null,
      textInputType: textInput ? typeof textInput : null
    });

    // Initialize Gemini API with appropriate configuration
    const model = genAI.getGenerativeModel({
      model: process.env.PAPERMAP_MODEL || "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    });
    
    // Start a chat with the system prompt
    let chat;
    
    if (chatHistory && chatHistory.length > 0) {
      // If we have chat history, use it
      const formattedHistory = chatHistory.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }));
      
      chat = model.startChat({
        history: formattedHistory,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
    } else {
      // If no history, start with the appropriate system prompt
      // Determine initial history based on whether this is follow-up, text input, or PDF
      let initialHistory;
      
      if (isFollowUp) {
        // First request is a follow-up -> sample map context needed
        initialHistory = [
          {
            role: "user",
            parts: [{ text: `${SYSTEM_PROMPT}\n\n--- Sample Document Context ---\n${EXAMPLE_PDF_TEXT}` }]
          },
          {
            role: "model",
            parts: [{ text: "I understand. I'll use the provided sample document context for follow-up questions. All responses will follow the exact JSON schemas you specified." }]
          }
        ];
      } else if (textInput && sourceUrl) {
        // First request is for web content-based mindmap
        initialHistory = [
          {
            role: "user",
            parts: [{ text: WEB_CONTENT_PROMPT }]
          },
          {
            role: "model",
            parts: [{ text: "I understand. I'll create a structured mindmap from the web content. All responses will follow the exact JSON schema you specified." }]
          }
        ];
      } else if (textInput) {
        // First request is for text-based mindmap
        initialHistory = [
          {
            role: "user",
            parts: [{ text: TEXT_INPUT_PROMPT }]
          },
          {
            role: "model",
            parts: [{ text: "I understand. I'll create structured mindmaps from the provided text input. All responses will follow the exact JSON schema you specified." }]
          }
        ];
      } else {
        // First request is PDF mindmap generation -> standard system prompt
        initialHistory = [
          {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT }]
          },
          {
            role: "model",
            parts: [{ text: "I understand. I'll analyze PDFs and create structured mindmaps for first requests, and provide focused answers for follow-up questions. All responses will follow the exact JSON schemas you specified." }]
          }
        ];
      }
      
      chat = model.startChat({
        history: initialHistory,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
    }
    
    // Prepare message parts based on whether this is initial request or follow-up
    let messageParts = [];
    
    if (isFollowUp) {
      // For follow-up questions, include the node context and question
      if (!question) {
        return NextResponse.json(
          { error: "Question is required for follow-up" },
          { status: 400 }
        );
      }

      if (!nodeContext || !nodeContext.title || !nodeContext.description) {
        return NextResponse.json(
          { error: "Node context is required for follow-up" },
          { status: 400 }
        );
      }

      messageParts = [
        { text: `This is a follow-up question about a specific node in the mindmap.\n\nNode Title: ${nodeContext.title}\nNode Description: ${nodeContext.description}\n\nQuestion: ${question}\n\n1. Answer the question directly without referring to "the authors" or "the paper."\n2. Focus on providing a comprehensive answer based on your knowledge.\n3. Be specific and include relevant details.\n4. Explain complex concepts in a clear, concise manner.\n5. Provide an answer that fully addresses the question.\n6. USE MARKDOWN FORMATTING in your answer to make it more visually appealing with **bold**, *italics*, bullet points, and other formatting features as appropriate.\n7. DO NOT reference the node, just answer the question.\n\nPlease provide answer in the format: { "answer": "your answer here" }` }
      ];
      
    } else if (textInput && sourceUrl) {
      // Handle web content input for mindmap generation
      messageParts = [
        { text: `Please create a structured mindmap about this web content:\n\n"${textInput}"\n\nThis content was extracted from the URL: ${sourceUrl}\n\nStructure Requirements:\n   - EXACTLY ONE root node with level=0 and parentId=null that summarizes the entire web page\n   - Every non-root node MUST have a parentId that matches an existing node's id\n   - Child nodes MUST have level = parent's level + 1\n   - IDs must be unique\n   - ORGANIZE BY TOPICS: Group related information into coherent sections\n   - INCLUDE KEY POINTS: Capture main arguments and conclusions\n   - AIM FOR DEPTH: Create 2-3 levels of hierarchy (root + 2 levels of children)\n\nDescription Style Requirements:\n   - Use direct statements that clearly explain concepts\n   - Include specific data points and key statistics from the content\n   - USE MARKDOWN FORMATTING in descriptions (bold, italics, bullet points)\n\nONLY GIVE THE JSON STRUCTURE. Do not include any additional text or context.` }
      ];
    } else if (textInput) {
      // Handle text-based input for mindmap generation
      messageParts = [
        { text: `Please create a structured mindmap about this topic or question:\n\n"${textInput}"\n\nStructure Requirements:\n   - EXACTLY ONE root node with level=0 and parentId=null\n   - Every non-root node MUST have a parentId that matches an existing node's id\n   - Child nodes MUST have level = parent's level + 1\n   - IDs must be unique\n   - AIM FOR DEPTH: Create 2-3 levels of hierarchy (root + 2 levels of children)\n   - BREAK DOWN CONCEPTS: Each major topic should be broken down into sub-topics\n   - DETAILED BRANCHING: Important concepts should branch into 2-3 child nodes\n\nDescription Style Requirements:\n   - Use direct statements: "This works by..." instead of "The concept works by..."\n   - Present information as facts and clear explanations\n   - Include specific examples where helpful\n   - USE MARKDOWN FORMATTING in descriptions (bold, italics, bullet points)\n\nKey Writing Principles:\n   - Write as if you're directly explaining the topic\n   - Use clear, concise language\n   - Include specific examples and applications\n\nONLY GIVE THE JSON STRUCTURE. Do not include any additional text or context.` }
      ];
    } else {
      // Initial mindmap creation for PDF
      if (!blobUrl) {
        return NextResponse.json(
          { error: "Either PDF blob URL or text input is required" },
          { status: 400 }
        );
      }

      console.log(`Processing PDF from blob URL: ${blobUrl.substring(0, 50)}...`);

      try {
        // OPTIMIZATION: For Vercel Blob URLs, use the remote file capability of Gemini API
        // instead of downloading the content and re-uploading it
        
        // Check if it's a Vercel Blob URL or other URL
        const isVercelBlobUrl = blobUrl.includes('vercel-blob.com');
        
        if (isVercelBlobUrl) {
          // Use the remote file reference capability of Gemini API
          // This avoids downloading and re-uploading the PDF
          messageParts = [
            { text: "Please analyze this PDF and create a structured mindmap following the format specified earlier.\n\nStructure Requirements:\n   - EXACTLY ONE root node with level=0 and parentId=null\n   - Every non-root node MUST have a parentId that matches an existing node's id\n   - Child nodes MUST have level = parent's level + 1\n   - IDs must be unique\n   - AIM FOR DEPTH: Create 2-3 levels of hierarchy (root + 2 levels of children)\n   - BREAK DOWN CONCEPTS: Each major topic should be broken down into sub-topics\n   - DETAILED BRANCHING: Important concepts should branch into 2-3 child nodes\n\nPAGE NUMBER REQUIREMENT (VERY IMPORTANT):\n   - EVERY node MUST include a \"pageNumber\" field\n   - Record the exact page number in the PDF where each piece of content is found\n   - Root node should typically use page number 1 (title/abstract page)\n   - If a concept spans multiple pages, use the page where the concept is first introduced\n   - Do not leave pageNumber as null except as a last resort\n\nDescription Style Requirements:\n   - Use direct statements: \"This experiment proves...\" instead of \"The authors show...\"\n   - Present findings as facts with specific numbers and results\n   - Explain causality and implications directly\n   - USE MARKDOWN FORMATTING in descriptions (bold, italics, bullet points)\n\nKey Writing Principles:\n   - Write as if you're directly explaining the content\n   - State findings and implications definitively\n   - Focus on what IS rather than what was studied\n   - Emphasize concrete results and their meaning\n\nONLY GIVE THE JSON STRUCTURE. Do not include any additional text or context." },
            {
              fileData: {
                mimeType: "application/pdf",
                fileUri: blobUrl
              }
            }
          ];
        } else {
          // For non-Vercel Blob URLs, fall back to the download method
          const pdfResponse = await fetch(blobUrl);
          if (!pdfResponse.ok) {
            throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
          }
          
          // Get the PDF as base64
          const pdfBuffer = await pdfResponse.arrayBuffer();
          const base64Data = Buffer.from(pdfBuffer).toString('base64');
          
          messageParts = [
            { text: "Please analyze this PDF and create a structured mindmap following the format specified earlier.\n\nStructure Requirements:\n   - EXACTLY ONE root node with level=0 and parentId=null\n   - Every non-root node MUST have a parentId that matches an existing node's id\n   - Child nodes MUST have level = parent's level + 1\n   - IDs must be unique\n   - AIM FOR DEPTH: Create 2-3 levels of hierarchy (root + 2 levels of children)\n   - BREAK DOWN CONCEPTS: Each major topic should be broken down into sub-topics\n   - DETAILED BRANCHING: Important concepts should branch into 2-3 child nodes\n\nPAGE NUMBER REQUIREMENT (VERY IMPORTANT):\n   - EVERY node MUST include a \"pageNumber\" field\n   - Record the exact page number in the PDF where each piece of content is found\n   - Root node should typically use page number 1 (title/abstract page)\n   - If a concept spans multiple pages, use the page where the concept is first introduced\n   - Do not leave pageNumber as null except as a last resort\n\nDescription Style Requirements:\n   - Use direct statements: \"This experiment proves...\" instead of \"The authors show...\"\n   - Present findings as facts with specific numbers and results\n   - Explain causality and implications directly\n   - USE MARKDOWN FORMATTING in descriptions (bold, italics, bullet points)\n\nKey Writing Principles:\n   - Write as if you're directly explaining the content\n   - State findings and implications definitively\n   - Focus on what IS rather than what was studied\n   - Emphasize concrete results and their meaning\n\nONLY GIVE THE JSON STRUCTURE. Do not include any additional text or context." },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data
              }
            }
          ];
        }
      } catch (error) {
        console.error("Error processing PDF from blob URL:", error);
        return NextResponse.json(
          { error: "Failed to process PDF from provided URL" },
          { status: 500 }
        );
      }
    }
    
    // Send the message and get response
    const response = await chat.sendMessage(messageParts);
    const responseText = response.response.text();

    // --- Robust JSON extraction and validation ---
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      try {
        responseData = JSON.parse(jsonrepair(responseText));
      } catch (err) {
        console.error("JSON parse/repair failed. Raw AI output:", responseText);
        return NextResponse.json({ success: false, error: "Could not parse AI response as JSON" }, { status: 500 });
      }
    }

    // Validate against schema
    let validated;
    if (isFollowUp) {
      validated = AnswerSchema.safeParse(responseData);
    } else {
      validated = MindmapSchema.safeParse(responseData);
    }
    if (!validated.success) {
      console.error("Schema validation failed:", validated.error, "Raw data:", responseData);
      return NextResponse.json({ success: false, error: "Response did not match expected schema" }, { status: 500 });
    }
    responseData = validated.data;
    // --- End robust JSON extraction and validation ---

    // Create the response data
    const newChatHistory = [
      ...(chatHistory || []),
      {
        role: "user",
        content: isFollowUp 
          ? `Follow-up question about ${nodeContext.title}: ${question}` 
          : textInput
            ? `Create a mindmap about: ${textInput}`
            : "Please create a mindmap from this PDF"
      },
      {
        role: "model",
        content: responseText
      }
    ];

    let formattedAnswer: string | undefined;
    let mindmapData: { nodes: any[] } | undefined;
    let mindmapId: string = ""; // Initialize mindmapId

    // Variables for persisted details, scoped for the non-follow-up case
    let persistedInputType: 'pdf' | 'text' | 'url' | undefined;
    let persistedPdfUrl: string | null | undefined;
    let persistedFileName: string | null | undefined;
    let persistedSourceUrl: string | null | undefined;

    if (isFollowUp) {
      // responseData is { answer: string }
      const answerData = responseData as { answer: string };
      if (typeof answerData.answer === 'string') {
        formattedAnswer = answerData.answer;
      } else if (answerData.answer) {
        formattedAnswer = JSON.stringify(answerData.answer);
      } else {
        formattedAnswer = JSON.stringify(answerData);
      }
    } else {
      // Not a follow-up, so it's a mindmap creation request
      mindmapData = responseData as { nodes: any[] };

      // --- DB INSERTION LOGIC ---
      // This 'if' block populates mindmapId and the persisted... variables
      if (mindmapData && mindmapData.nodes && Array.isArray(mindmapData.nodes) && mindmapData.nodes.length > 0) {
        mindmapId = uuidv4();
        const rootNode = mindmapData.nodes.find((n: any) => n.parentId === null);
        const title = rootNode ? rootNode.title : 'Untitled Mindmap';
        
        // Determine persistedInputType
        if (blobUrl && !textInput) { 
          persistedInputType = originalFileName ? 'pdf' : 'url';
        } else if (textInput && sourceUrl) {
          persistedInputType = 'url';
        } else if (textInput) {
          persistedInputType = 'text';
        } else if (blobUrl) { // If only blobUrl is present (e.g. URL processed to blob, but not original file)
           persistedInputType = 'url';
        } else {
          persistedInputType = 'text'; 
        }

        persistedPdfUrl = blobUrl || null;
        
        // Determine persistedFileName
        if (persistedInputType === 'pdf' && originalFileName) {
          persistedFileName = originalFileName;
        } else if (persistedInputType === 'url' && sourceUrl) {
          try {
            const parsedUrl = new URL(sourceUrl);
            const pathSegments = parsedUrl.pathname.split('/');
            const lastSegment = pathSegments.pop();
            if (lastSegment && lastSegment.trim() !== '' && lastSegment !== '/') {
              persistedFileName = decodeURIComponent(lastSegment);
            } else {
              persistedFileName = parsedUrl.hostname;
            }
            if (persistedFileName === '/' || !persistedFileName) persistedFileName = parsedUrl.hostname || "Web Document";
          } catch {
            persistedFileName = title || "Web Document"; // Fallback if URL parsing fails
          }
        } else if (title) {
          persistedFileName = title;
        } else {
          persistedFileName = 'Untitled Mindmap';
        }
        
        persistedSourceUrl = sourceUrl || null;

        // Initial insert into mindmaps table (without parsed_pdf_content yet)
        const now = new Date();
        await db.insert(mindmaps).values({
          id: mindmapId,
          title, 
          inputType: persistedInputType,
          pdfUrl: persistedPdfUrl,
          fileName: persistedFileName,
          sourceUrl: persistedSourceUrl,
          // parsed_pdf_content will be updated asynchronously
          createdAt: now,
          updatedAt: now,
          userId,
        });

        // Insert nodes
        const nodeInserts = mindmapData.nodes.map((node: any) => ({
          mindmapId,
          nodeId: node.id,
          title: node.title,
          description: node.description,
          parentId: node.parentId,
          level: node.level,
          pageNumber: node.pageNumber ?? null,
        }));
        if (nodeInserts.length > 0) {
          await db.insert(mindmapNodes).values(nodeInserts);
        }

        // Fire-and-forget: fetch from Jina and update the mindmap record in background
        // This is intentionally NOT awaited to avoid blocking the response
        if (persistedPdfUrl && (persistedInputType === 'pdf' || persistedInputType === 'url')) {
          fetchPdfMarkdownAndUpdateDb(mindmapId, persistedPdfUrl).catch(err => {
            console.error('[Background] Jina fetch failed:', err);
          });
        }
      }
      // --- END DB INSERTION LOGIC ---
    }

    // --- Consistent response envelope ---
    const responseObject = {
      success: true,
      ...(isFollowUp 
        ? { answer: formattedAnswer } 
        : { 
            mindmap: mindmapData, 
            mindmapId,
            persistedInputType, 
            persistedPdfUrl,    
            persistedFileName,  
            persistedSourceUrl  
          }),
      chatHistory: newChatHistory,
      inputType: textInput ? (sourceUrl ? 'url' : 'text') : (blobUrl ? (originalFileName ? 'pdf' : 'url') : 'unknown')
    };
    // --- End consistent response envelope ---

    return NextResponse.json(responseObject);
    
  } catch (error) {
    console.error("Error in API route:", error);
    
    // Extract error message
    let errorMessage = "Unknown error occurred while processing the request";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Helper function to fetch PDF markdown from Jina and update the database
// This function is designed to be called without awaiting its completion (fire and forget)
async function fetchPdfMarkdownAndUpdateDb(mindmapId: string, pdfUrl: string) {
  try {
    const jinaReaderApiUrl = `https://r.jina.ai/${encodeURIComponent(pdfUrl)}`;
    console.log(`[Background] Fetching PDF content from Jina Reader for mindmap ${mindmapId}: ${jinaReaderApiUrl}`);
    
    const jinaResponse = await fetch(jinaReaderApiUrl, {
      headers: {
        "Accept": "text/markdown, text/plain;q=0.9, */*;q=0.8", // Prefer markdown
      }
    });

    if (jinaResponse.ok) {
      const parsedPdfMarkdown = await jinaResponse.text();
      console.log(`[Background] Successfully fetched PDF content from Jina Reader for mindmap ${mindmapId}. Length: ${parsedPdfMarkdown.length}`);
      
      // Sanitize the markdown content to remove null characters
      const sanitizedMarkdown = parsedPdfMarkdown.replace(/\0/g, '');

      // Update the mindmaps table
      await db.update(mindmaps)
        .set({ parsed_pdf_content: sanitizedMarkdown, updatedAt: new Date() })
        .where(eq(mindmaps.id, mindmapId));
      console.log(`[Background] Successfully updated mindmap ${mindmapId} with parsed PDF content.`);
    } else {
      const errorText = await jinaResponse.text();
      console.warn(`[Background] Jina Reader failed for mindmap ${mindmapId} (URL: ${pdfUrl}): ${jinaResponse.status} ${jinaResponse.statusText}. Response: ${errorText.substring(0, 200)}`);
    }
  } catch (jinaError: any) {
    console.error(`[Background] Error calling Jina Reader or updating DB for mindmap ${mindmapId} (URL: ${pdfUrl}):`, jinaError.message);
  }
}
