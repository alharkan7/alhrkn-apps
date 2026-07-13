import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest } from 'next/server';
import { jsonrepair } from 'jsonrepair';
import { db } from '@/db';
import { inztagramDiagrams, inztagramDiagramVersions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  FREEFORM_SYSTEM_PROMPT,
  FREEFORM_GENERATION_CONFIG,
  buildFreeformUserPrompt,
  freeformAssistantSeedMessage,
  sanitizeDiagramTitle,
} from '../../../../inztagram/lib/svg-diagram-prompt';
import { getFreeformLayout } from '../../../../inztagram/components/freeform-layouts';
import { sanitizeSvg } from '../../../../inztagram/lib/sanitize-svg';
import type { InztagramMessage } from '../../../../inztagram/lib/types';

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8192,
  },
});

const freeformResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    svg: { type: SchemaType.STRING },
    title: { type: SchemaType.STRING },
    detailLevel: { type: SchemaType.STRING },
  },
  required: ["svg"]
};

function parseModelJson(responseText: string): any {
  try {
    return JSON.parse(responseText);
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return JSON.parse(jsonrepair(match[0]));
      }
    }
    return JSON.parse(jsonrepair(responseText));
  }
}

async function buildPdfPart(pdfUrl: string) {
  const pdfResponse = await fetch(pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
  }
  const pdfBuffer = await pdfResponse.arrayBuffer();
  const base64Data = Buffer.from(pdfBuffer).toString('base64');
  return { inlineData: { mimeType: 'application/pdf', data: base64Data } };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    const { id } = await params;
    const record = await db.query.inztagramDiagrams.findFirst({
      where: eq(inztagramDiagrams.id, id),
    });

    if (!record) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    if (record.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    if (record.svgCode) {
      return new Response(JSON.stringify({ svg: record.svgCode }), { status: 200 });
    }

    const messages = (record.messages as InztagramMessage[]) || [];
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No prompt found' }), { status: 400 });
    }

    let description, pdfUrl, pdfName, layout;
    try {
      const parsed = JSON.parse(messages[0].content);
      description = parsed.description;
      pdfUrl = parsed.pdfUrl;
      pdfName = parsed.pdfName;
      layout = parsed.layout;
    } catch {
      description = messages[0].content;
    }

    const userBrief = description || pdfName || 'Create a clear diagram from the attached PDF.';
    const layoutPreset = getFreeformLayout(layout);
    const prompt = buildFreeformUserPrompt(userBrief, {
      fromPdf: Boolean(pdfUrl),
      layoutInstructions: layoutPreset?.instructions,
      layoutLabel: layoutPreset?.label,
    });

    const contentParts: any[] = [{ text: `${FREEFORM_SYSTEM_PROMPT}\n\n${prompt}` }];
    if (pdfUrl) {
      contentParts.push(await buildPdfPart(pdfUrl));
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: contentParts }],
      generationConfig: {
        ...FREEFORM_GENERATION_CONFIG,
        responseMimeType: "application/json",
        responseSchema: freeformResponseSchema as any
      }
    });

    const responseText = result.response.text().trim();
    let parsed: any;
    try {
      parsed = parseModelJson(responseText);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse model response' }), { status: 500 });
    }

    if (!parsed.svg || typeof parsed.svg !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing svg in model response' }), { status: 500 });
    }

    let svg: string;
    try {
      svg = sanitizeSvg(parsed.svg);
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || 'Invalid SVG' }), { status: 500 });
    }

    const title = sanitizeDiagramTitle(parsed.title);
    const shortTitle = description?.slice(0, 40) || pdfName || 'New Diagram';
    
    // Create actual user message to replace the JSON blob
    const newMessages: InztagramMessage[] = [
      {
        role: 'user',
        content: description || (pdfName ? `Create diagram from ${pdfName}` : 'Create diagram from PDF'),
        createdAt: messages[0].createdAt,
      },
      {
        role: 'assistant',
        content: freeformAssistantSeedMessage(title || shortTitle),
        createdAt: new Date().toISOString(),
      }
    ];

    await db.update(inztagramDiagrams)
      .set({ 
        svgCode: svg,
        messages: newMessages
      })
      .where(eq(inztagramDiagrams.id, id));

    await db.insert(inztagramDiagramVersions).values({
      diagramId: id,
      svgCode: svg,
      mermaidCode: null,
    });

    return new Response(JSON.stringify({ svg }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in /api/inztagram/[id]/generate:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
