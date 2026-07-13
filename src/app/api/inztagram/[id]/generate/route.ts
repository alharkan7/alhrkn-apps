import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest } from 'next/server';
import { jsonrepair } from 'jsonrepair';
import { db } from '@/db';
import { inztagramDiagrams, inztagramDiagramVersions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  FREEFORM_EDIT_SYSTEM_PROMPT,
  FREEFORM_SYSTEM_PROMPT,
  FREEFORM_GENERATION_CONFIG,
  buildFreeformUserPrompt,
  freeformAssistantSeedMessage,
  sanitizeDiagramTitle,
} from '@/app/inztagram/lib/svg-diagram-prompt';
import { getFreeformLayout } from '@/app/inztagram/components/freeform-layouts';
import { sanitizeSvg } from '@/app/inztagram/lib/sanitize-svg';
import type { InztagramMessage } from '@/app/inztagram/lib/types';

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
    summary: { type: SchemaType.STRING },
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

async function buildImagePart(imageUrl: string) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  const buffer = await imageResponse.arrayBuffer();
  const base64Data = Buffer.from(buffer).toString('base64');
  let mimeType = 'image/png';
  if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg') || imageUrl.startsWith('data:image/jpeg')) mimeType = 'image/jpeg';
  return { inlineData: { mimeType, data: base64Data } };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {}

    let message = typeof body.message === 'string' ? body.message.trim() : '';
    let isAutoImprove = false;
    let autoImproveImage = '';
    
    if (message.startsWith('{') && message.includes('"action":"auto_improve"')) {
      try {
        const payload = JSON.parse(message);
        if (payload.action === 'auto_improve') {
          isAutoImprove = true;
          autoImproveImage = payload.image;
          message = 'Please analyze the attached image of the current diagram and the SVG code, and improve the diagram aesthetically and structurally (fix overlaps, improve contrast, optimize layout). Return the updated SVG.';
        }
      } catch (e) {}
    }

    const [diagram] = await db
      .select()
      .from(inztagramDiagrams)
      .where(and(eq(inztagramDiagrams.id, id), eq(inztagramDiagrams.userId, user.id)))
      .limit(1);

    if (!diagram) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    const isInitial = !diagram.svgCode && !message;
    let priorMessages = (diagram.messages || []) as InztagramMessage[];
    
    const contentParts: any[] = [];
    let isEditMode = !isInitial;

    if (isInitial) {
      if (priorMessages.length === 0) {
        return new Response(JSON.stringify({ error: 'No prompt found' }), { status: 400 });
      }

      let description, pdfUrl, pdfName, layout;
      try {
        const parsed = JSON.parse(priorMessages[0].content);
        description = parsed.description;
        pdfUrl = parsed.pdfUrl;
        pdfName = parsed.pdfName;
        layout = parsed.layout;
      } catch {
        description = priorMessages[0].content;
      }

      const userBrief = description || pdfName || 'Create a clear diagram from the attached PDF.';
      const layoutPreset = getFreeformLayout(layout);
      const prompt = buildFreeformUserPrompt(userBrief, {
        fromPdf: Boolean(pdfUrl),
        layoutInstructions: layoutPreset?.instructions,
        layoutLabel: layoutPreset?.label,
      });

      contentParts.push({ text: `${FREEFORM_SYSTEM_PROMPT}\n\n${prompt}` });
      if (pdfUrl) {
        contentParts.push(await buildPdfPart(pdfUrl));
      }
      
      const shortTitle = description?.slice(0, 40) || pdfName || 'New Diagram';
      priorMessages = [
        {
          role: 'user',
          content: description || (pdfName ? `Create diagram from ${pdfName}` : 'Create diagram from PDF'),
          createdAt: priorMessages[0]?.createdAt || new Date().toISOString(),
        }
      ];

    } else {
      if (!message) {
        return new Response(JSON.stringify({ error: 'Missing message for edit' }), { status: 400 });
      }

      const recent = priorMessages.slice(-10);
      const historyBlock = recent
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      const promptText = `
Conversation so far:
${historyBlock || '(none)'}

Current SVG:
${diagram.svgCode}

User edit request:
${message}

Return the full updated SVG and a one-sentence summary of the change.
If the message includes a "Selected SVG element context" section, prioritize editing those elements. Preserve unrelated parts of the diagram unless the request requires a broader change.`;

      contentParts.push({ text: `${FREEFORM_EDIT_SYSTEM_PROMPT}\n\n${promptText}` });

      if (isAutoImprove && autoImproveImage) {
         if (autoImproveImage.startsWith('data:image/')) {
            const mimeType = autoImproveImage.match(/data:(.*?);/)?.[1] || 'image/png';
            const base64Data = autoImproveImage.replace(/^data:image\/\w+;base64,/, '');
            contentParts.push({ inlineData: { mimeType, data: base64Data } });
         } else {
            contentParts.push(await buildImagePart(autoImproveImage));
         }
      }
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

    let svg = '';
    try {
      svg = sanitizeSvg(parsed.svg);
    } catch (e: any) {
      svg = parsed.svg; // Fallback to raw if sanitize fails
    }

    const summary = parsed.summary || (isInitial ? 'Generated diagram' : 'Updated diagram');
    let nextMessages = [...priorMessages];

    if (isInitial) {
       const titleNode = sanitizeDiagramTitle(parsed.title) || diagram.description || 'Diagram';
       nextMessages.push({ role: 'assistant', content: freeformAssistantSeedMessage(titleNode), createdAt: new Date().toISOString() });
    } else {
       if (message) {
          nextMessages.push({ role: 'user', content: message, createdAt: new Date().toISOString() });
       }
       nextMessages.push({ role: 'assistant', content: summary, createdAt: new Date().toISOString() });
    }

    await db.update(inztagramDiagrams).set({
      svgCode: svg,
      messages: nextMessages,
      updatedAt: new Date(),
    }).where(and(eq(inztagramDiagrams.id, id), eq(inztagramDiagrams.userId, user.id)));

    await db.insert(inztagramDiagramVersions).values({
      diagramId: id,
      svgCode: svg,
      mermaidCode: null,
    });

    return new Response(JSON.stringify({ svg, summary, messages: nextMessages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in /api/inztagram/[id]/generate:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
