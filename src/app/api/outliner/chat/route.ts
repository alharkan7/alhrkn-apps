import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, logOutlinerEvent } from '../logger';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface FileAttachment {
  name: string;
  type: string;
  size: number;
  data: string; // base64 encoded
}

interface ChatRequest {
  message: string;
  context?: string;
  history?: ChatMessage[];
  files?: FileAttachment[];
}

// You'll need to set this in your environment variables
const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const body: ChatRequest = await request.json();
    const { message, context, history, files } = body;

    if (!message && (!files || files.length === 0)) {
      return NextResponse.json(
        { error: 'Message or files are required' },
        { status: 400 }
      );
    }

    // Build context-aware prompt
    let systemPrompt = `You are an AI assistant helping with research paper writing and academic content creation.

You have access to the following document context:
${context || 'No specific document context provided.'}

Please provide helpful, accurate, and relevant responses in markdown format to help with research, writing, and academic tasks. Use proper markdown formatting for code blocks, lists, headings, and other elements when appropriate.`;

    // Add conversation history if available
    if (history && history.length > 0) {
      systemPrompt += '\n\nConversation history:\n';
      history.forEach((msg, index) => {
        systemPrompt += `${index + 1}. ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
    }

    const fullPrompt = `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;

    // Prepare request for Gemini API
    const geminiRequest: any = {
      contents: [
        {
          parts: [
            {
              text: fullPrompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    // Add files to the request if present
    if (files && files.length > 0) {
      files.forEach(file => {
        geminiRequest.contents[0].parts.push({
          inline_data: {
            mime_type: file.type,
            data: file.data
          }
        });
      });
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      return new Response(
        `data: ${JSON.stringify({ type: 'error', error: 'Failed to get AI response' })}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    const data = await response.json();

    // Extract the response text from Gemini
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.error('Unexpected Gemini response format:', data);
      return new Response(
        `data: ${JSON.stringify({ type: 'error', error: 'Invalid response format' })}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // Clean up the response (remove any "Assistant:" prefix if present)
    const cleanResponse = generatedText.replace(/^Assistant:\s*/, '').trim();

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const words = cleanResponse.split(' ');
        let index = 0;

        const sendChunk = async () => {
          if (index < words.length) {
            const chunk = words.slice(index, index + 3).join(' ') + ' ';
            const data = `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`;
            controller.enqueue(encoder.encode(data));
            index += 3;

            // Send next chunk after a small delay to simulate streaming
            setTimeout(sendChunk, 100);
          } else {
            // Send completion signal
            const data = `data: ${JSON.stringify({ type: 'complete' })}\n\n`;
            controller.enqueue(encoder.encode(data));
            controller.close();
            
            try {
              await logOutlinerEvent(user.id, 'chat', body, cleanResponse);
            } catch (e) {
              console.error('Failed to log to DB:', e);
            }
          }
        };

        sendChunk();
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
    console.error('Chat API error:', error);
    return new Response(
      `data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }
}
