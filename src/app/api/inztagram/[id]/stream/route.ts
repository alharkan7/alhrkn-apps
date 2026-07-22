import { streamObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { inztagramDiagrams, inztagramDiagramVersions } from '@/db/schema';
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

    const streamConfig: any = {
      model: google(process.env.INZTAGRAM_STREAM_MODEL || 'gemini-2.5-flash'),
      system: systemInstruction,
      schema: z.object({
        svg: z.string().describe('The raw SVG code. Must be complete and well-formed.'),
        title: z.string().optional().describe('Short title for the diagram'),
        summary: z.string().optional().describe('A one-sentence summary of what you generated or changed.'),
      }),
      onFinish: ({ object }: any) => {
        // Run DB updates asynchronously without blocking the stream closure
        (async () => {
          try {
            let rawSvg = object?.svg || '<svg></svg>';
          if (rawSvg.toLowerCase().includes('<svg') && !rawSvg.toLowerCase().includes('</svg>')) {
            rawSvg += '</svg>';
          }
          
          let svg = '';
          try {
            svg = sanitizeSvg(rawSvg, false);
          } catch (sanitizeErr) {
            console.error("Failed to strictly sanitize SVG on server, saving raw:", sanitizeErr);
            svg = rawSvg; // Fallback to raw if sanitize fails, client will still sanitize on render
          }

          const summary = object?.summary || (isInitial ? 'Generated diagram' : 'Updated diagram');
          
          let nextMessages = [...priorMessages];
          if (isInitial) {
             const titleNode = object?.title || diagram.description || 'Diagram';
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
        } catch (e) {
          console.error("Failed to save stream result to DB", e);
        }
        })();
      }
    };

    if (isAutoImprove && autoImproveImage) {
      streamConfig.messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            { type: 'image', image: new URL(autoImproveImage) }
          ]
        }
      ];
    } else {
      streamConfig.prompt = promptText;
    }

    const result = await streamObject(streamConfig);

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Error in /api/inztagram/[id]/stream:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
