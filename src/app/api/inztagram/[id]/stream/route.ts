import { streamObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { inztagramDiagrams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  FREEFORM_EDIT_SYSTEM_PROMPT,
  FREEFORM_SYSTEM_PROMPT,
  buildFreeformUserPrompt,
  freeformAssistantSeedMessage
} from '@/app/inztagram/lib/svg-diagram-prompt';
import { getFreeformLayout } from '@/app/inztagram/components/freeform-layouts';
import { sanitizeSvg } from '@/app/inztagram/lib/sanitize-svg';
import type { InztagramMessage } from '@/app/inztagram/lib/types';

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable');
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
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    const [diagram] = await db
      .select()
      .from(inztagramDiagrams)
      .where(and(eq(inztagramDiagrams.id, id), eq(inztagramDiagrams.userId, user.id)))
      .limit(1);

    if (!diagram) {
      return new Response(JSON.stringify({ error: 'Diagram not found' }), { status: 404 });
    }

    if (diagram.mode !== 'freeform') {
      return new Response(JSON.stringify({ error: 'Stream edits are only supported for freeform' }), { status: 400 });
    }

    const isInitial = !diagram.svgCode;
    let systemInstruction = '';
    let promptText = '';
    let priorMessages = (diagram.messages || []) as InztagramMessage[];

    if (isInitial) {
      // First generation - parse config from the first seed message
      let config: any = {};
      try {
        config = JSON.parse(priorMessages[0]?.content || '{}');
      } catch (e) {
        config = { description: priorMessages[0]?.content };
      }
      
      const { description, pdfUrl, pdfName, layout } = config;
      const userBrief = description || pdfName || 'Create a clear diagram.';
      const layoutPreset = getFreeformLayout(layout);
      
      systemInstruction = FREEFORM_SYSTEM_PROMPT;
      promptText = buildFreeformUserPrompt(userBrief, {
        fromPdf: Boolean(pdfUrl),
        layoutInstructions: layoutPreset?.instructions,
        layoutLabel: layoutPreset?.label,
      });

      // Update prior messages to hide the JSON config from chat history
      const shortTitle = description?.slice(0, 40) || pdfName || 'New Diagram';
      priorMessages = [
        {
          role: 'user',
          content: description || (pdfName ? `Create diagram from ${pdfName}` : 'Create diagram from PDF'),
          createdAt: priorMessages[0]?.createdAt || new Date().toISOString(),
        }
      ];

    } else {
      // Edit mode
      if (!message) {
        return new Response(JSON.stringify({ error: 'Missing message' }), { status: 400 });
      }
      
      const recent = priorMessages.slice(-10);
      const historyBlock = recent
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      systemInstruction = FREEFORM_EDIT_SYSTEM_PROMPT;
      promptText = `
Conversation so far:
${historyBlock || '(none)'}

Current SVG:
${diagram.svgCode}

User edit request:
${message}

Return the full updated SVG and a one-sentence summary of the change.
If the message includes a "Selected SVG element context" section, prioritize editing those elements. Preserve unrelated parts of the diagram unless the request requires a broader change.`;
    }

    const result = await streamObject({
      model: google('gemini-2.5-flash', {
        useSearchGrounding: false
      }),
      system: systemInstruction,
      prompt: promptText,
      schema: z.object({
        svg: z.string().describe('The raw SVG code. Must be complete and well-formed.'),
        title: z.string().optional().describe('Short title for the diagram'),
        summary: z.string().optional().describe('A one-sentence summary of what you generated or changed.'),
      }),
      onFinish: async ({ object }) => {
        try {
          const svg = sanitizeSvg(object?.svg || '<svg></svg>');
          const summary = object?.summary || (isInitial ? 'Generated diagram' : 'Updated diagram');
          
          let nextMessages = [...priorMessages];
          if (isInitial) {
             nextMessages.push({ role: 'assistant', content: freeformAssistantSeedMessage(object?.title || diagram.description || 'Diagram'), createdAt: new Date().toISOString() });
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
        } catch (e) {
          console.error("Failed to save stream result to DB", e);
        }
      }
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Error in /api/inztagram/[id]/stream:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
