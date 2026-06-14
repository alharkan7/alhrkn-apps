import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest } from 'next/server';
import { getAuthUser, logOutlinerEvent } from './logger';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 2048,
  },
});

const responseSchema = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
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
      },
      minItems: 1,
      maxItems: 10
    }
  },
  required: ['ideas'],
  propertyOrdering: ['ideas']
};

// Language-specific response schemas
const responseSchemaId = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
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
      },
      minItems: 1,
      maxItems: 10
    }
  },
  required: ['ideas'],
  propertyOrdering: ['ideas']
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

    const body = await req.json();
    const { keywords, numIdeas, language = 'en' } = body || {};
    
    // Debug logging
    console.log('Regular API called with:', { keywords, numIdeas, language });

    if (!keywords || typeof keywords !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid "keywords"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ideasCount = Math.min(Math.max(Number(numIdeas) || 6, 1), 10);

    // Language-specific instructions
    const languageConfig = {
      en: {
        systemInstruction: 'You are an academic research assistant. Generate concise, high-quality research ideas with structured abstracts.',
        userPrompt: `Task: Propose ${ideasCount} distinct research ideas based on the following keywords.
Keywords: ${keywords}

For each idea, produce a title and a general abstract broken into:
- research background
- literature review
- research method
- analysis technique
- impact

Keep sections compact and concrete (2–4 sentences each). Avoid duplication across ideas.`
      },
      id: {
        systemInstruction: 'Anda adalah asisten penelitian akademik. Buat ide penelitian yang ringkas dan berkualitas tinggi dengan abstrak yang terstruktur dalam Bahasa Indonesia. PENTING: Semua output harus dalam Bahasa Indonesia.',
        userPrompt: `Tugas: Usulkan ${ideasCount} ide penelitian yang berbeda berdasarkan kata kunci berikut.
Kata kunci: ${keywords}

PENTING: Semua konten (judul, background, literature review, method, analysis technique, impact) HARUS dalam Bahasa Indonesia.

Untuk setiap ide, buat judul dan abstrak umum yang dibagi menjadi:
- latar belakang penelitian
- tinjauan literatur
- metode penelitian
- teknik analisis
- dampak

Jaga agar setiap bagian ringkas dan konkret (2–4 kalimat). Hindari duplikasi antar ide.

SEMUA TEKS HARUS DALAM BAHASA INDONESIA.`
      }
    };

    const config = languageConfig[language as keyof typeof languageConfig] || languageConfig.en;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: config.systemInstruction }] },
        { role: 'user', parts: [{ text: config.userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: (language === 'id' ? responseSchemaId : responseSchema) as any
      }
    });

    const responseText = result.response.text().trim();

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return new Response(JSON.stringify({ error: 'Failed to parse model response as JSON', raw: responseText }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!parsed?.ideas || !Array.isArray(parsed.ideas)) {
      return new Response(JSON.stringify({ error: 'Model response missing ideas array', raw: parsed }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await logOutlinerEvent(user.id, 'generate', body, JSON.stringify(parsed));

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/outliner:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}


