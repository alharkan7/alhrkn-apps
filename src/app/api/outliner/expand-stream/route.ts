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
  model: process.env.OUTLINER_EXPAND_STREAM_MODEL || 'gemini-2.5-flash',
});

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

    const body = await req.json();
    const { idea, language = 'en' } = body || {};
    
    console.log('Expand Stream API called with:', { title: idea?.title, language });

    if (!idea || typeof idea !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing or invalid "idea" object' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Language-specific instructions (Markdown output)
    const languageConfig = {
      en: {
        systemInstruction: `You are an expert academic writing assistant. You will expand a brief research idea into a comprehensive research outline.

Return content in clean Markdown only. Use a clear hierarchy of headings and lists:
- Use '# ' for the document title
- Use '## ' for top-level sections (Introduction, Literature Review, Methodology, Expected Results and Impact, Timeline and Resources, Conclusion)
- Use '### ' for subsections
- Use paragraphs of 2-5 sentences
- Use unordered lists '-' for bullet points and ordered lists '1.' for sequences
- Inline formatting: **bold** for key terms, *italic* for emphasis, ` + "`code`" + ` for identifiers, and [links](https://example.com) when appropriate

CRITICAL: Do NOT include any markdown code fences (\`\`\`), YAML frontmatter, HTML, tables, images, or any metadata. Start directly with the document title using # and continue with content only.`,
        userPrompt: `Task: Expand the following brief research idea into a comprehensive, detailed research outline in Markdown.

Input Research Idea:
Title: ${idea.title}
Background: ${idea.abstract.background}
Literature Review: ${idea.abstract.literatureReview}
Method: ${idea.abstract.method}
Analysis Technique: ${idea.abstract.analysisTechnique}
Impact: ${idea.abstract.impact}

Requirements:
- Academic tone, concrete details
- Logical flow from Introduction to Conclusion
- Substantial content in each section (multiple paragraphs or lists)
- Output must be Markdown only`
      },
      id: {
        systemInstruction: `Anda adalah asisten penulisan akademik ahli. Anda akan memperluas ide penelitian singkat menjadi outline penelitian yang komprehensif.

Kembalikan konten dalam Markdown bersih saja. Gunakan hierarki heading dan list yang jelas:
- Gunakan '# ' untuk judul dokumen
- Gunakan '## ' untuk bagian tingkat atas (Pendahuluan, Tinjauan Literatur, Metodologi, Hasil dan Dampak yang Diharapkan, Timeline dan Sumber Daya, Kesimpulan)
- Gunakan '### ' untuk subbagian
- Gunakan paragraf 2-5 kalimat
- Gunakan list tak berurutan '-' untuk poin dan list berurutan '1.' untuk urutan
- Pemformatan inline: **tebal** untuk istilah kunci, *miring* untuk penekanan, ` + "`kode`" + ` untuk identifier, dan [tautan](https://contoh.com) bila sesuai

PENTING: JANGAN sertakan markdown code fences (\`\`\`), YAML frontmatter, HTML, tabel, gambar, atau metadata apapun. Mulai langsung dengan judul dokumen menggunakan # dan lanjutkan hanya dengan konten.`,
        userPrompt: `Tugas: Perluas ide penelitian berikut menjadi outline penelitian yang detail dalam Markdown.

Ide Penelitian:
Judul: ${idea.title}
Latar Belakang: ${idea.abstract.background}
Tinjauan Literatur: ${idea.abstract.literatureReview}
Metode: ${idea.abstract.method}
Teknik Analisis: ${idea.abstract.analysisTechnique}
Dampak: ${idea.abstract.impact}

Persyaratan:
- Gaya akademik, rinci dan konkret
- Alur logis dari Pendahuluan hingga Kesimpulan
- Konten substansial di setiap bagian (beberapa paragraf atau list)
- Output harus Markdown saja`
      }
    };

    const config = languageConfig[language as keyof typeof languageConfig] || languageConfig.en;

    // Set up Server-Sent Events
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Starting streaming generation...');
          
          const result = await model.generateContentStream({
            contents: [
              { role: 'user', parts: [{ text: config.systemInstruction + '\n\n' + config.userPrompt }] },
            ],
            generationConfig: {
              temperature: 0.7,
              topP: 0.9,
              topK: 40,
              maxOutputTokens: 8192
            },
          });

          let fullText = '';
          
          // Send initial connection event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullText += chunkText;
            // Forward chunk to client as SSE JSON
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`));
          }

          console.log('Stream completed, final text length:', fullText.length);
          
          // Send completion event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'completed' })}\n\n`));
          controller.close();
          
          // Record to DB
          try {
            await db.insert(outlinerEvents).values({
              userId: user.id,
              action: 'expand-stream',
              inputPayload: JSON.stringify(body),
              outputPayload: fullText,
            });
          } catch (e) {
            console.error('Failed to log to DB', e);
          }
          
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
  } catch (error: any) {
    console.error('Error in /api/outliner/expand-stream:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
