import { GoogleGenerativeAI } from '@/lib/google-ai-proxy';
import { NextRequest } from 'next/server';
import { getAuthUser, logOutlinerEvent } from '../logger';

// Environment validation
const googleApiKey = process.env.GOOGLE_API_KEY;
if (!googleApiKey) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(googleApiKey);

// Schema for structured response
const structuredResponseSchema = {
  type: 'object',
  properties: {
    paraphrasedText: { type: 'string' },
  },
  required: ['paraphrasedText'],
  propertyOrdering: ['paraphrasedText']
};

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { text, language = 'en' } = body || {};
    const shouldStream = (req.headers.get('x-stream') || '').toLowerCase() === '1';

    console.log('Paraphrase API called with language:', language);

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Missing or invalid "text". Provide text to paraphrase.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate language parameter
    if (language !== 'en' && language !== 'id') {
      return new Response(JSON.stringify({ error: 'Invalid language parameter. Must be "en" or "id".' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract citations from the input text
    const citationRegex = /\([^)]+,\s*\d{4}\)|\([^)]+\s+\d{4}\)|\([^)]+,\s*\d{2,4}\)|\([^)]+\s+\d{2,4}\)/g;
    const citations = text.match(citationRegex) || [];
    const citationsList = citations.join(', ');

    // Enhanced system prompt for paraphrasing
    const getParaphrasePrompt = (inputText: string, citations: string[], lang: 'en' | 'id') => {
      if (lang === 'id') {
        const citationsSection = citations.length > 0 
          ? `\nKutipan yang HARUS dipertahankan (jangan ubah formatnya):\n${citations.join(', ')}\n` 
          : '';
        const preserveInstruction = citations.length > 0 
          ? `2. PERTAHANKAN semua kutipan dalam format yang sama persis: ${citations.join(', ')}\n` 
          : '2. Tidak ada kutipan yang perlu dipertahankan\n';
        
        return `Anda adalah asisten penulisan akademik yang ahli dalam memparafrase teks penelitian. Tugas Anda adalah menulis ulang teks yang dipilih dengan kata-kata yang berbeda sambil mempertahankan makna dan struktur akademis yang sama.

Teks yang akan diparafrase:
"""
${inputText}
"""${citationsSection}
Instruksi penting:
1. Tulis ulang teks dengan kata-kata yang berbeda tetapi makna yang sama
${preserveInstruction}3. Jangan ubah struktur atau urutan informasi
4. Gunakan nada akademis yang sama
5. Pastikan parafrase terdengar alami dan mudah dibaca
6. Jangan tambahkan informasi baru atau menghilangkan informasi yang ada
7. Output teks biasa saja, bukan HTML atau format khusus${citations.length > 0 ? '\n8. Jika ada kutipan, pastikan posisinya dalam kalimat tetap logis' : ''}

Tulis parafrase dari teks di atas:`;
      } else {
        const citationsSection = citations.length > 0 
          ? `\nCitations that MUST be preserved (do not change their format):\n${citations.join(', ')}\n` 
          : '';
        const preserveInstruction = citations.length > 0 
          ? `2. PRESERVE all citations in exactly the same format: ${citations.join(', ')}\n` 
          : '2. No citations need to be preserved\n';
        
        return `You are an academic writing assistant expert at paraphrasing research text. Your task is to rewrite the selected text using different words while maintaining the same meaning and academic structure.

Text to paraphrase:
"""
${inputText}
"""${citationsSection}
Important instructions:
1. Rewrite the text using different words but the same meaning
${preserveInstruction}3. Do not change the structure or order of information
4. Use the same academic tone
5. Ensure the paraphrase sounds natural and readable
6. Do not add new information or remove existing information
7. Output plain text only, not HTML or special formatting${citations.length > 0 ? '\n8. If there are citations, ensure their position in sentences remains logical' : ''}

Write the paraphrase of the text above:`;
      }
    };

    // If streaming is requested, stream raw plaintext as it is generated
    if (shouldStream) {
      const model = genAI.getGenerativeModel({
        model: process.env.OUTLINER_PARAPHRASE_MODEL || 'gemini-2.5-flash-lite',
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
          responseMimeType: 'text/plain',
        },
      });

      const prompt = getParaphrasePrompt(text, citations, language);

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let fullText = '';
          try {
            const result = await model.generateContentStream(prompt);
            for await (const chunk of result.stream) {
              const piece = String(chunk?.text?.() ?? '');
              if (piece) {
                fullText += piece;
                controller.enqueue(encoder.encode(piece));
              }
            }
            controller.close();
            await logOutlinerEvent(user.id, 'paraphrase', body, fullText);
          } catch (e: any) {
            try { controller.enqueue(encoder.encode(`\n[STREAM_ERROR]: ${e?.message || 'failed'}\n`)); } catch {}
            controller.close();
          }
        }
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no'
        }
      });
    }

    // Non-streaming: Use Gemini to generate structured JSON
    const model = genAI.getGenerativeModel({
      model: process.env.OUTLINER_PARAPHRASE_MODEL || 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: structuredResponseSchema as any,
      },
    });

    const prompt = getParaphrasePrompt(text, citations, language);

    const result = await model.generateContent(prompt);
    const jsonText = String(result?.response?.text?.() ?? '').trim();
    
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // Try to extract JSON if the response isn't clean
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      }
    }

    if (!parsed || typeof parsed?.paraphrasedText !== 'string') {
      return new Response(JSON.stringify({ error: 'Failed to generate structured output', raw: jsonText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const responseJson = {
      paraphrasedText: parsed.paraphrasedText,
    };

    await logOutlinerEvent(user.id, 'paraphrase', body, JSON.stringify(responseJson));

    return new Response(
      JSON.stringify(responseJson),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in /api/outliner/paraphrase:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
