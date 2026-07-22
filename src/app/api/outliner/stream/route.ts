import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { outlinerEvents, outlinerQueries } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { eq, and } from 'drizzle-orm';

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
    const body = await req.json();
    const { queryId, numIdeas, existingTitles = [] } = body || {};

    if (!queryId || typeof queryId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid "queryId"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the query from DB
    const queryRecords = await db
      .select()
      .from(outlinerQueries)
      .where(and(eq(outlinerQueries.id, queryId), eq(outlinerQueries.userId, user.id)))
      .limit(1);

    if (queryRecords.length === 0) {
      return new Response(JSON.stringify({ error: 'Query not found or unauthorized' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const queryRecord = queryRecords[0];
    const keywords = queryRecord.keywords;
    const language = queryRecord.language || 'en';

    console.log('Stream API called for query:', { queryId, keywords, numIdeas, language, existingTitlesCount: existingTitles?.length });

    const ideasCount = Math.min(Math.max(Number(numIdeas) || 6, 1), 10);

    const avoidPrompt = existingTitles && existingTitles.length > 0 
      ? `\nCRITICAL: You MUST NOT generate any of the following ideas that were already provided:\n${existingTitles.map((t: string) => `- ${t}`).join('\n')}\nGenerate COMPLETELY NEW and DIFFERENT ideas.` 
      : '';

    // Language-specific instructions
    const languageConfig = {
      en: {
        systemInstruction: 'You are an academic research assistant. Generate concise, high-quality research ideas with structured abstracts. Stream each idea as soon as it is ready.',
        userPrompt: `Task: Propose ${ideasCount} distinct research ideas based on the following keywords.
Keywords: ${keywords}
${avoidPrompt}

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
${avoidPrompt}

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

    const result = await model.generateContentStream({
      contents: [
        { role: 'user', parts: [{ text: config.systemInstruction + '\n\n' + config.userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'text/plain',
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = '';
        let fullResponse = '';
        const parsedIdeas: any[] = [];
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            buffer += text;

            let depth = 0;
            let start = -1;
            let inString = false;
            let isEscaped = false;
            let lastValidEnd = -1;

            for (let i = 0; i < buffer.length; i++) {
              const char = buffer[i];
              if (isEscaped) { isEscaped = false; continue; }
              if (char === '\\') { isEscaped = true; continue; }
              if (char === '"') { inString = !inString; continue; }

              if (!inString) {
                if (char === '{') {
                  if (depth === 0) start = i;
                  depth++;
                } else if (char === '}') {
                  if (depth > 0) {
                    depth--;
                    if (depth === 0 && start !== -1) {
                      const objStr = buffer.substring(start, i + 1);
                      const safe = sanitizeIdeaLine(objStr);
                      if (safe) {
                        controller.enqueue(encoder.encode(safe + '\n'));
                        fullResponse += safe + '\n';
                        try { parsedIdeas.push(JSON.parse(safe)); } catch {}
                      }
                      start = -1;
                      lastValidEnd = i;
                    }
                  }
                }
              }
            }

            if (lastValidEnd !== -1) {
              buffer = buffer.substring(lastValidEnd + 1);
            }
          }
          controller.close();
          
          try {
            // Update the ideas in the queries table
            const currentIdeas = (queryRecord.ideas as any[]) || [];
            const updatedIdeas = [...currentIdeas, ...parsedIdeas];
            await db.update(outlinerQueries)
              .set({ ideas: updatedIdeas, updatedAt: new Date() })
              .where(eq(outlinerQueries.id, queryId));
            
            // Keep original log as well
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
    console.error(error);
    return new Response(JSON.stringify({
      error: error?.message || 'Internal server error',
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

    const getVal = (o: any, key: string) => {
      const lowerKey = key.toLowerCase();
      const actualKey = Object.keys(o).find(k => k.toLowerCase() === lowerKey);
      return actualKey ? o[actualKey] : undefined;
    };

    let titleRaw = getVal(obj, 'title') || getVal(obj, 'name') || getVal(obj, 'topic') || '';
    const title = typeof titleRaw === 'string' ? titleRaw : '';

    let abstractRaw = getVal(obj, 'abstract') || getVal(obj, 'summary') || {};
    const abstract = abstractRaw && typeof abstractRaw === 'object' ? abstractRaw : {};

    const background = typeof getVal(abstract, 'background') === 'string' ? getVal(abstract, 'background') : '';
    const literatureReview = typeof getVal(abstract, 'literatureReview') === 'string' ? getVal(abstract, 'literatureReview') : (typeof getVal(abstract, 'literature_review') === 'string' ? getVal(abstract, 'literature_review') : '');
    const method = typeof getVal(abstract, 'method') === 'string' ? getVal(abstract, 'method') : (typeof getVal(abstract, 'methodology') === 'string' ? getVal(abstract, 'methodology') : '');
    const analysisTechnique = typeof getVal(abstract, 'analysisTechnique') === 'string' ? getVal(abstract, 'analysisTechnique') : (typeof getVal(abstract, 'analysis_technique') === 'string' ? getVal(abstract, 'analysis_technique') : '');
    const impact = typeof getVal(abstract, 'impact') === 'string' ? getVal(abstract, 'impact') : '';

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
