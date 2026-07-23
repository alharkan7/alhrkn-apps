import { GoogleGenerativeAI } from '@/lib/google-ai-proxy';
import { GoogleAIFileManager } from '@/lib/google-ai-proxy';
import { NextRequest } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { tools } from '@/app/chat/utils/tools';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';

if (!process.env.GOOGLE_API_KEY) {
    throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY);

// Add system prompt configuration
const SYSTEM_PROMPT = `You are a helpful AI assistant. You can help with a wide range of tasks including:
- Answering questions on any topic
- Writing and analyzing code
- Mathematical calculations (using the calculate function when needed)
- Explaining complex concepts
- Helping with analysis and problem-solving
- Processing and analyzing images and documents

For mathematical calculations, use the calculate function only when precise computation is needed. Otherwise, provide direct answers to questions.

Use markdown formatting to style your text answer to make it more readable and appealing for user.`;

const model = genAI.getGenerativeModel({
    model: process.env.CHAT_MODEL || "gemini-2.5-flash",
    generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
    },
    tools: tools,  // Add tools configuration
    systemInstruction: SYSTEM_PROMPT
});

// Helper function to get file extension from mime type
function getFileExtension(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
        // Images
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',

        // Code files
        'text/x-c': 'c',
        'text/x-cpp': 'cpp',
        'text/x-python': 'py',
        'text/x-java': 'java',
        'text/x-php': 'php',
        'text/x-sql': 'sql',

        // Documents
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/rtf': 'rtf',
        'application/vnd.ms-word.template.macroenabled.12': 'dot',
        'application/vnd.openxmlformats-officedocument.wordprocessingtemplate': 'dotx',
        'application/x-hwp': 'hwp',
        'application/x-hwpx': 'hwpx',

        // Google Workspace
        'application/vnd.google-apps.document': 'gdoc',
        'application/vnd.google-apps.presentation': 'gslides',
        'application/vnd.google-apps.spreadsheet': 'gsheet',

        // Presentations
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',

        // Spreadsheets
        'application/vnd.ms-excel': 'xls',
        'text/csv': 'csv',

        // Plain text
        'text/plain': 'txt',
        'text/markdown': 'md'
    };
    return mimeToExt[mimeType] || 'bin';
}

// Helper function to convert base64 to buffer and upload to Gemini
type FileUploadResult = {
    mimeType: string;
    data?: string;
    fileUri?: string;
};

async function uploadBase64ToGemini(base64String: string, mimeType: string, fileName: string): Promise<FileUploadResult> {
    try {
        // Remove data URL prefix if present
        const base64Data = base64String.replace(/^data:.*;base64,/, '');
        
        // For images, return the base64 data directly
        if (mimeType.startsWith('image/')) {
            return {
                mimeType,
                data: base64Data
            };
        }

        // For non-image files, use file manager
        const buffer = Buffer.from(base64Data, 'base64');
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-'));
        const extension = getFileExtension(mimeType);
        // avoid path.join to prevent @vercel/nft from tracing all files matching this dynamic pattern
        const tempFilePath = `${tempDir}/${crypto.randomUUID()}.${extension}`;

        await fs.writeFile(tempFilePath, buffer);

        const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: mimeType,
            displayName: fileName
        });

        // Cleanup
        try {
            await fs.unlink(tempFilePath);
            await fs.rmdir(tempDir);
        } catch (cleanupError) {
            console.warn('Failed to cleanup temp files:', cleanupError);
        }

        return {
            mimeType: uploadResult.file.mimeType,
            fileUri: uploadResult.file.uri
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

// Add this helper function
async function fetchAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch from url: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
}



export async function POST(req: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user?.id) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await req.json();
        const { messages, sessionId } = body;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Messages array is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!sessionId) {
            return new Response(JSON.stringify({ error: 'Session ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create encoder for streaming
        const encoder = new TextEncoder();

        // Create the stream
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Format history for Gemini
                    const history = messages.slice(0, -1).map(msg => ({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: typeof msg.content === 'string' ? msg.content : msg.content.map((p: { text: string }) => p.text).join(' ') }]
                    }));

                    // Get the last message
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage.role !== 'user') {
                        throw new Error('Last message must be from user');
                    }

                    // Create chat instance
                    const chat = model.startChat({
                        history: history.length > 0 ? history : undefined
                    });

                    // Format last message parts
                    let messageParts: any[] = [];
                    
                    if (Array.isArray(lastMessage.content)) {
                        for (const part of lastMessage.content) {
                            if (part.type === 'text') {
                                messageParts.push({ text: part.text });
                            }
                            // Handle images and files only if text parts fail
                            else if (messageParts.length === 0) {
                                if (part.type === 'image_url' && part.image_url?.url) {
                                    try {
                                        let base64Data = part.image_url.url;
                                        if (part.image_url.url.startsWith('http')) {
                                            base64Data = await fetchAsBase64(part.image_url.url);
                                        } else {
                                            base64Data = part.image_url.url.replace(/^data:.*;base64,/, '');
                                        }
                                        messageParts.push({
                                            inlineData: {
                                                mimeType: 'image/jpeg',
                                                data: base64Data
                                            }
                                        });
                                    } catch (error) {
                                        console.error('Failed to process image:', error);
                                        messageParts.push({ text: "⚠️ Failed to process image" });
                                    }
                                } else if (part.type === 'file_url' && part.file_url?.url) {
                                    try {
                                        let base64Data = part.file_url.url;
                                        if (part.file_url.url.startsWith('http')) {
                                            base64Data = await fetchAsBase64(part.file_url.url);
                                        }
                                        const fileData = await uploadBase64ToGemini(
                                            base64Data,
                                            part.file_url.type,
                                            part.file_url.name
                                        );
                                        if (fileData.fileUri) {
                                            messageParts.push({
                                                fileData: {
                                                    mimeType: fileData.mimeType,
                                                    fileUri: fileData.fileUri,
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        console.error('Failed to process file:', error);
                                        messageParts.push({ text: "⚠️ Failed to process file" });
                                    }
                                }
                            }
                        }
                    } else {
                        messageParts = [{ text: lastMessage.content }];
                    }

                    // Ensure we have at least one part
                    if (messageParts.length === 0) {
                        messageParts = [{ text: "I couldn't process your message. Could you please rephrase it?" }];
                    }

                    try {
                        // Get response for the last message
                        const result = await chat.sendMessage(messageParts);
                        const text = await result.response.text();

                        // Stream the response
                        const words = text.split(' ');
                        for (const word of words) {
                            const data = { content: word + ' ' };
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                            await new Promise(resolve => setTimeout(resolve, 50));
                        }

                        // Save the full chat session to the database
                        const allMessages = [...messages, { role: 'assistant', content: [{ type: 'text', text }] }];
                        let title = 'New Chat';
                        if (allMessages.length > 0) {
                            const firstContent = allMessages[0].content;
                            if (typeof firstContent === 'string') {
                                title = firstContent.substring(0, 50);
                            } else if (Array.isArray(firstContent)) {
                                const textPart = firstContent.find((p: any) => p.type === 'text');
                                if (textPart && textPart.text) {
                                    title = textPart.text.substring(0, 50);
                                }
                            }
                        }

                        try {
                            await db.insert(chatSessions).values({
                                id: sessionId,
                                userId: user.id,
                                title: title,
                                messages: allMessages,
                                updatedAt: new Date()
                            }).onConflictDoUpdate({
                                target: chatSessions.id,
                                set: {
                                    messages: allMessages,
                                    updatedAt: new Date()
                                }
                            });
                        } catch (dbError) {
                            console.error('Failed to save chat session to DB:', dbError);
                        }
                    } catch (error) {
                        console.error('Error in chat response:', error);
                        const errorMessage = { content: "I apologize, but I encountered an error processing your request. Please try again." };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
                    }

                    controller.close();
                } catch (error) {
                    console.error('Error in stream:', error);
                    const errorMessage = { content: "An error occurred. Please try again." };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}