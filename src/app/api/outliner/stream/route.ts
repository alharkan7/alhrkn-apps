import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { outlinerEvents } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: process.env.OUTLINER_STREAM_MODEL || 'gemini-2.5-flash',
});

const ideaSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    abstract: {
      type: 'object',
      properties: {
        background: { type: 'string' },
        literatureReview: { type: 'string' },
        method: { type: 'string' },
        analysisTechnique: { type: 'string' },
        impact: { type: 'string' }
      },
      required: ['background', 'literatureReview', 'method', 'analysisTechnique', 'impact'],
      propertyOrdering: ['background', 'literatureReview', 'method', 'analysisTechnique', 'impact']
    }
  },
  required: ['title', 'abstract'],
  propertyOrdering: ['title', 'abstract']
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('=== OUTLINER STREAM API START ===');
    console.log('Environment check - GOOGLE_GENERATIVE_AI_API_KEY exists:', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);

    const body = await req.json();
    const { keywords, numIdeas, language = 'en' } = body || {};

    // Debug logging
    console.log('Stream API called with:', { keywords, numIdeas, language });

    if (!keywords || typeof keywords !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid "keywords"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ideasCount = Math.min(Math.max(Number(numIdeas) || 6, 1), 10);

    // For debugging - return a simple test response if requested
    if (keywords === '__TEST__') {
      console.log('Returning test response for debugging');
      const testResponse = '{"title":"Test Research Idea","abstract":{"background":"Test background","literatureReview":"Test literature review","method":"Test method","analysisTechnique":"Test analysis","impact":"Test impact"}}\n';
      return new Response(testResponse, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Language-specific instructions
    const languageConfig = {
      en: {
        systemInstruction: 'You are an academic research assistant. Generate concise, high-quality research ideas with structured abstracts. Stream each idea as soon as it is ready.',
        userPrompt: `Task: Propose ${ideasCount} distinct research ideas based on the following keywords.
Keywords: ${keywords}

Output format: Newline-delimited JSON (NDJSON). Emit exactly one JSON object per line, with no leading or trailing commentary, and no enclosing array.
Example format for each line:
{"title":"...","abstract":{"background":"...","literatureReview":"...","method":"...","analysisTechnique":"...","impact":"..."}}

CRITICAL CONSTRAINTS:
- DO NOT PRETTY PRINT THE JSON.
- EACH JSON OBJECT MUST BE FULLY MINIFIED AND FIT ENTIRELY ON A SINGLE LINE.
- DO NOT INCLUDE ANY NEWLINE CHARACTERS WITHIN THE JSON OBJECT.
- Start output immediately; do not wait to finish planning.
- Keep sections compact and concrete (2–4 sentences each).
- Avoid duplication across ideas.
- Do not include markdown, code fences, or any text other than NDJSON lines.`
      },
      id: {
        systemInstruction: 'Anda adalah asisten penelitian akademik. Buat ide penelitian yang ringkas dan berkualitas tinggi dengan abstrak yang terstruktur dalam Bahasa Indonesia. Streaming setiap ide segera setelah siap. PENTING: Semua output harus dalam Bahasa Indonesia.',
        userPrompt: `Tugas: Usulkan ${ideasCount} ide penelitian yang berbeda berdasarkan kata kunci berikut.
Kata kunci: ${keywords}

PENTING: Semua konten (judul, background, literature review, method, analysis technique, impact) HARUS dalam Bahasa Indonesia.

Format output: Newline-delimited JSON (NDJSON). Emitkan tepat satu objek JSON per baris, tanpa komentar awal atau akhir, dan tanpa array pembungkus.
Format contoh untuk setiap baris:
{"title":"...","abstract":{"background":"...","literatureReview":"...","method":"...","analysisTechnique":"...","impact":"..."}}

KENDALA KRITIS:
- JANGAN PRETTY PRINT JSON.
- SETIAP OBJEK JSON HARUS SEPENUHNYA DIMINIFY DAN MUAT SELURUHNYA DALAM SATU BARIS.
- JANGAN SERTAKAN KARAKTER NEWLINE DI DALAM OBJEK JSON.
- Mulai output segera; jangan menunggu untuk menyelesaikan perencanaan.
- Jaga agar setiap bagian ringkas dan konkret (2–4 kalimat).
- Hindari duplikasi antar ide.
- Jangan sertakan markdown, code fences, atau teks lain selain baris NDJSON.
- SEMUA TEKS HARUS DALAM BAHASA INDONESIA.`
      }
    };

    const config = languageConfig[language as keyof typeof languageConfig] || languageConfig.en;
    console.log('Using language config:', language);
    console.log('Model configuration - attempting to call Gemini API...');

    const result = await model.generateContentStream({
      contents: [
        { role: 'user', parts: [{ text: config.systemInstruction + '\n\n' + config.userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'text/plain',
      },
    });

    console.log('Streaming setup - creating ReadableStream...');
    const encoder = new TextEncoder();
    let chunkCount = 0;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = '';
        let fullResponse = '';
        try {
          console.log('Starting to read from result.stream...');
          for await (const chunk of result.stream) {
            chunkCount++;
            const text = chunk.text();
            console.log(`Chunk ${chunkCount}: received text of length ${text.length}`);
            buffer += text;
            let idx: number;
            while ((idx = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 1);
              const trimmed = line.trim();
              if (!trimmed) continue;
              const safe = sanitizeIdeaLine(trimmed);
              if (safe) {
                console.log(`Enqueuing sanitized idea line: ${safe.substring(0, 100)}...`);
                controller.enqueue(encoder.encode(safe + '\n'));
                fullResponse += safe + '\n';
              }
            }
          }
          const remaining = buffer.trim();
          if (remaining) {
            const safe = sanitizeIdeaLine(remaining);
            if (safe) {
              console.log(`Enqueuing final sanitized idea line: ${safe.substring(0, 100)}...`);
              controller.enqueue(encoder.encode(safe + '\n'));
              fullResponse += safe + '\n';
            }
          }
          console.log(`Stream completed - processed ${chunkCount} chunks`);
          controller.close();
          
          try {
            await db.insert(outlinerEvents).values({
              userId: user.id,
              action: 'stream',
              inputPayload: JSON.stringify(body),
              outputPayload: fullResponse,
            });
          } catch (e) {
            console.error('Failed to log to DB', e);
          }
        } catch (err) {
          console.error('Error in streaming:', err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('=== OUTLINER STREAM API ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Full error object:', JSON.stringify(error, null, 2));

    // Check for specific Google AI errors
    if (error?.message?.includes('API_KEY')) {
      console.error('API KEY ERROR: Check GOOGLE_GENERATIVE_AI_API_KEY environment variable');
    } else if (error?.message?.includes('model')) {
      console.error('MODEL ERROR: Check if the model is available');
    } else if (error?.message?.includes('quota') || error?.message?.includes('billing')) {
      console.error('QUOTA/BILLING ERROR: Check Google AI Studio billing and quota');
    }

    return new Response(JSON.stringify({
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function sanitizeIdeaLine(line: string): string | null {
  try {
    const obj = JSON.parse(line);
    if (!obj || typeof obj !== 'object') return null;

    // Basic validation - just ensure we have the expected structure
    const title = typeof obj.title === 'string' ? obj.title : '';
    const abstract = obj.abstract && typeof obj.abstract === 'object' ? obj.abstract : {};

    // More lenient validation - allow empty strings but ensure structure exists
    const background = typeof abstract.background === 'string' ? abstract.background : '';
    const literatureReview = typeof abstract.literatureReview === 'string' ? abstract.literatureReview : '';
    const method = typeof abstract.method === 'string' ? abstract.method : '';
    const analysisTechnique = typeof abstract.analysisTechnique === 'string' ? abstract.analysisTechnique : '';
    const impact = typeof abstract.impact === 'string' ? abstract.impact : '';

    // Only require that title exists - the rest can be empty strings
    if (!title.trim()) {
      return null;
    }

    const clean = {
      title: title.trim(),
      abstract: { background, literatureReview, method, analysisTechnique, impact },
    };
    return JSON.stringify(clean);
  } catch {
    return null;
  }
}


