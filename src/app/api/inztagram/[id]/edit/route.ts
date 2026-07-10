import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest } from 'next/server';
import { jsonrepair } from 'jsonrepair';
import { db } from '@/db';
import { inztagramDiagrams, inztagramDiagramVersions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  FREEFORM_EDIT_SYSTEM_PROMPT,
  FREEFORM_EDIT_GENERATION_CONFIG,
} from '@/app/inztagram/lib/svg-diagram-prompt';
import { sanitizeSvg } from '@/app/inztagram/lib/sanitize-svg';
import type { InztagramMessage } from '@/app/inztagram/lib/types';

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    ...FREEFORM_EDIT_GENERATION_CONFIG,
  },
});

const editResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    svg: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
  },
  required: ['svg', 'summary'],
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [diagram] = await db
      .select()
      .from(inztagramDiagrams)
      .where(and(eq(inztagramDiagrams.id, id), eq(inztagramDiagrams.userId, user.id)))
      .limit(1);

    if (!diagram) {
      return new Response(JSON.stringify({ error: 'Diagram not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (diagram.mode !== 'freeform') {
      return new Response(JSON.stringify({ error: 'Follow-up edits are only supported for freeform diagrams' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!diagram.svgCode) {
      return new Response(JSON.stringify({ error: 'Diagram has no SVG content' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const priorMessages = (diagram.messages || []) as InztagramMessage[];
    const recent = priorMessages.slice(-10);
    const historyBlock = recent
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = `${FREEFORM_EDIT_SYSTEM_PROMPT}

Conversation so far:
${historyBlock || '(none)'}

Current SVG:
${diagram.svgCode}

User edit request:
${message}

Return the full updated SVG and a one-sentence summary of the change.
If the user wants more detail or new entities, expand density and canvas as needed; if they want simplification, reduce clutter deliberately.
If the message includes a "Selected SVG element context" section (one or more attached elements), prioritize editing those elements. Preserve unrelated parts of the diagram unless the request requires a broader change.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        ...FREEFORM_EDIT_GENERATION_CONFIG,
        responseMimeType: 'application/json',
        responseSchema: editResponseSchema as any,
      },
    });

    const responseText = result.response.text().trim();
    let parsed: any;
    try {
      parsed = parseModelJson(responseText);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse model response', raw: responseText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!parsed.svg || typeof parsed.svg !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing svg in model response', raw: responseText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let svg: string;
    try {
      svg = sanitizeSvg(parsed.svg);
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || 'Invalid SVG from model' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'Updated the diagram based on your request.';

    const now = new Date().toISOString();
    const nextMessages: InztagramMessage[] = [
      ...priorMessages,
      { role: 'user', content: message, createdAt: now },
      { role: 'assistant', content: summary, createdAt: now },
    ];

    await db
      .update(inztagramDiagrams)
      .set({
        svgCode: svg,
        messages: nextMessages,
        updatedAt: new Date(),
      })
      .where(and(eq(inztagramDiagrams.id, id), eq(inztagramDiagrams.userId, user.id)));

    await db.insert(inztagramDiagramVersions).values({
      diagramId: id,
      svgCode: svg,
      mermaidCode: null,
    });

    return new Response(JSON.stringify({
      svg,
      summary,
      messages: nextMessages,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/inztagram/[id]/edit:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
