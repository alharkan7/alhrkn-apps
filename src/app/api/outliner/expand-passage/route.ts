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
    paragraphs: { type: 'array', items: { type: 'string' }, minItems: 1 },
  },
  required: ['paragraphs'],
  propertyOrdering: ['paragraphs']
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
    const { text, language = 'en', section = 'Unknown' } = body || {};
    const shouldStream = (req.headers.get('x-stream') || '').toLowerCase() === '1';

    console.log('Expand-passage API called with language:', language, 'section:', section);

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Missing or invalid "text". Provide a paragraph or context string to expand.' }), {
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

    // Enhanced system prompt with better context understanding
    const getEnhancedPrompt = (inputText: string, currentSection: string, lang: 'en' | 'id') => {
      const sectionContext = lang === 'id' 
        ? getIndonesianSectionContext(currentSection)
        : getEnglishSectionContext(currentSection);

      if (lang === 'id') {
        return `Anda adalah asisten penulisan akademik yang ahli dalam memperluas teks penelitian. Tugas Anda adalah menambahkan konten baru yang memperjelas dan memperluas teks yang dipilih, BUKAN menggantinya.

${sectionContext}

Teks yang akan diperluas:
"""
${inputText}
"""

Instruksi penting:
1. JANGAN mengganti atau mengulang teks yang sudah ada
2. Tulis 1-2 paragraf BARU yang menambahkan informasi, penjelasan, atau contoh yang relevan
3. Pastikan konten baru mengalir secara alami dari teks yang dipilih
4. Gunakan nada dan gaya yang sesuai dengan bagian "${currentSection}"
5. Fokus pada aspek yang belum dijelaskan dalam teks asli
6. Berikan contoh konkret, data pendukung, atau penjelasan mendalam jika relevan
7. Output teks biasa saja, pisahkan paragraf dengan baris kosong
8. Jangan sertakan kutipan seperti [1], [2,3], dll.

Tulis konten yang akan ditambahkan setelah teks yang dipilih:`;
      } else {
        return `You are an academic writing assistant expert at expanding research text. Your task is to ADD new content that clarifies and expands the selected text, NOT replace it.

${sectionContext}

Text to expand:
"""
${inputText}
"""

Important instructions:
1. DO NOT replace or repeat existing text
2. Write 1-2 NEW paragraphs that add relevant information, explanations, or examples
3. Ensure new content flows naturally from the selected text
4. Use tone and style appropriate for the "${currentSection}" section
5. Focus on aspects not already explained in the original text
6. Provide concrete examples, supporting data, or deeper explanations if relevant
7. Output plain text only, separate paragraphs with blank lines
8. Do not include citations such as [1], [2,3], etc.

Write the content to be added after the selected text:`;
      }
    };

    // Helper functions for section-specific context
    const getEnglishSectionContext = (section: string) => {
      const sectionLower = section.toLowerCase();
      if (sectionLower.includes('background') || sectionLower.includes('introduction')) {
        return `Context: You are writing in the Background/Introduction section. This section should:
- Provide foundational knowledge and context
- Explain the problem or research gap
- Set up the research question or hypothesis
- Use a broad, informative tone that establishes the foundation for the research`;
      } else if (sectionLower.includes('literature') || sectionLower.includes('review')) {
        return `Context: You are writing in the Literature Review section. This section should:
- Analyze and synthesize existing research
- Identify gaps, controversies, or areas for further study
- Connect different research findings
- Use an analytical, critical tone that demonstrates understanding of the field`;
      } else if (sectionLower.includes('method') || sectionLower.includes('methodology')) {
        return `Context: You are writing in the Research Method section. This section should:
- Explain procedures, techniques, and approaches in detail
- Justify methodological choices with rationale
- Describe data collection and analysis methods
- Use a precise, technical tone focused on methodology`;
      } else if (sectionLower.includes('analysis') || sectionLower.includes('technique')) {
        return `Context: You are writing in the Analysis Technique section. This section should:
- Explain analytical frameworks and tools
- Describe data processing and interpretation methods
- Detail statistical or qualitative analysis approaches
- Use a technical, methodical tone focused on analysis`;
      } else if (sectionLower.includes('result') || sectionLower.includes('finding')) {
        return `Context: You are writing in the Results/Findings section. This section should:
- Present data and findings objectively
- Highlight key results and patterns
- Use clear, factual language
- Focus on what was discovered, not interpretation`;
      } else if (sectionLower.includes('discussion') || sectionLower.includes('implication')) {
        return `Context: You are writing in the Discussion/Implications section. This section should:
- Interpret and analyze the significance of results
- Connect findings to research questions
- Discuss broader implications and applications
- Use an analytical, interpretive tone`;
      } else if (sectionLower.includes('conclusion') || sectionLower.includes('summary')) {
        return `Context: You are writing in the Conclusion section. This section should:
- Summarize key findings and contributions
- Discuss limitations and future research directions
- Provide final thoughts on the research significance
- Use a conclusive, forward-looking tone`;
      } else {
        return `Context: You are writing in the "${section}" section. Maintain appropriate academic tone and focus on expanding the selected text with relevant additional information.`;
      }
    };

    const getIndonesianSectionContext = (section: string) => {
      const sectionLower = section.toLowerCase();
      if (sectionLower.includes('latar') || sectionLower.includes('pendahuluan')) {
        return `Konteks: Anda menulis di bagian Latar Belakang/Pendahuluan. Bagian ini harus:
- Memberikan pengetahuan dasar dan konteks
- Menjelaskan masalah atau kesenjangan penelitian
- Menyiapkan pertanyaan penelitian atau hipotesis
- Menggunakan nada informatif yang luas untuk membangun fondasi penelitian`;
      } else if (sectionLower.includes('tinjauan') || sectionLower.includes('literatur')) {
        return `Konteks: Anda menulis di bagian Tinjauan Literatur. Bagian ini harus:
- Menganalisis dan mensintesis penelitian yang ada
- Mengidentifikasi kesenjangan, kontroversi, atau area untuk penelitian lebih lanjut
- Menghubungkan temuan penelitian yang berbeda
- Menggunakan nada analitis dan kritis yang menunjukkan pemahaman bidang`;
      } else if (sectionLower.includes('metode') || sectionLower.includes('metodologi')) {
        return `Konteks: Anda menulis di bagian Metode Penelitian. Bagian ini harus:
- Menjelaskan prosedur, teknik, dan pendekatan secara detail
- Membenarkan pilihan metodologis dengan alasan yang jelas
- Menjelaskan metode pengumpulan dan analisis data
- Menggunakan nada teknis yang presisi dan fokus pada metodologi`;
      } else if (sectionLower.includes('analisis') || sectionLower.includes('teknik')) {
        return `Konteks: Anda menulis di bagian Teknik Analisis. Bagian ini harus:
- Menjelaskan kerangka kerja dan alat analitis
- Menjelaskan metode pemrosesan dan interpretasi data
- Merinci pendekatan analisis statistik atau kualitatif
- Menggunakan nada teknis dan metodis yang fokus pada analisis`;
      } else if (sectionLower.includes('hasil') || sectionLower.includes('temuan')) {
        return `Konteks: Anda menulis di bagian Hasil/Temuan. Bagian ini harus:
- Menyajikan data dan temuan secara objektif
- Menyoroti hasil dan pola utama
- Menggunakan bahasa yang jelas dan faktual
- Fokus pada apa yang ditemukan, bukan interpretasi`;
      } else if (sectionLower.includes('diskusi') || sectionLower.includes('implikasi')) {
        return `Konteks: Anda menulis di bagian Diskusi/Implikasi. Bagian ini harus:
- Menginterpretasikan dan menganalisis signifikansi hasil
- Menghubungkan temuan dengan pertanyaan penelitian
- Membahas implikasi dan aplikasi yang lebih luas
- Menggunakan nada analitis dan interpretatif`;
      } else if (sectionLower.includes('kesimpulan') || sectionLower.includes('simpulan')) {
        return `Konteks: Anda menulis di bagian Kesimpulan. Bagian ini harus:
- Merangkum temuan dan kontribusi utama
- Membahas keterbatasan dan arah penelitian masa depan
- Memberikan pemikiran akhir tentang signifikansi penelitian
- Menggunakan nada konklusif dan berorientasi masa depan`;
      } else {
        return `Konteks: Anda menulis di bagian "${section}". Pertahankan nada akademis yang sesuai dan fokus pada memperluas teks yang dipilih dengan informasi tambahan yang relevan.`;
      }
    };

    // If streaming is requested, stream raw plaintext paragraphs as they are generated
    if (shouldStream) {
      const model = genAI.getGenerativeModel({
        model: process.env.OUTLINER_EXPAND_PASSAGE_MODEL || 'gemini-2.5-flash-lite',
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 2048,
          responseMimeType: 'text/plain',
        },
      });

      const prompt = getEnhancedPrompt(text, section, language);

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
            await logOutlinerEvent(user.id, 'expand-passage', body, fullText);
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

    // Non-streaming: Use Gemini to generate structured JSON with paragraphs
    const model = genAI.getGenerativeModel({
      model: process.env.OUTLINER_EXPAND_PASSAGE_MODEL || 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: structuredResponseSchema as any,
      },
    });

    const prompt = getEnhancedPrompt(text, section, language);

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

    if (!parsed || !Array.isArray(parsed?.paragraphs)) {
      return new Response(JSON.stringify({ error: 'Failed to generate structured output', raw: jsonText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const responseJson = {
      paragraphs: parsed.paragraphs,
    };

    await logOutlinerEvent(user.id, 'expand-passage', body, JSON.stringify(responseJson));

    return new Response(
      JSON.stringify(responseJson),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in /api/outliner/expand-passage:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}


