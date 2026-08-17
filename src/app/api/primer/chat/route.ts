import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { getModel } from '@/lib/ai';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Ephemeral, context-aware chat about the lesson the reader is currently viewing.
// No DB reads or writes: the full conversation is sent each turn and the system
// prompt is rebuilt from the reading context (lesson title/topic/excerpt + the
// glossary tooltip the reader launched from, if any).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const messages = rawMessages
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing messages' }), { status: 400 });
    }
    if (messages[messages.length - 1].role !== 'user') {
      return new Response(JSON.stringify({ error: 'Last message must be from user' }), { status: 400 });
    }

    const ctx = body?.context && typeof body.context === 'object' ? body.context : {};
    const lessonTitle = typeof ctx.lessonTitle === 'string' ? ctx.lessonTitle.trim() : '';
    const topic = typeof ctx.topic === 'string' ? ctx.topic.trim() : '';
    const excerpt = typeof ctx.excerpt === 'string' ? ctx.excerpt.trim().slice(0, 800) : '';
    const attachment = ctx.attachment && typeof ctx.attachment === 'object' ? ctx.attachment : null;
    const term = typeof attachment?.term === 'string' ? attachment.term.trim() : '';
    const definition = typeof attachment?.definition === 'string' ? attachment.definition.trim() : '';

    const systemParts: string[] = [
      'You are Primer\'s study companion, embedded in an interactive lesson.',
    ];
    if (lessonTitle || topic) {
      systemParts.push(
        `The reader is studying the lesson ${lessonTitle ? `titled "${lessonTitle}"` : ''}${lessonTitle && topic ? ' ' : ''}${topic ? `(topic: ${topic})` : ''}.`,
      );
    }
    systemParts.push(
      'Help them understand ideas, correct misconceptions, and make connections. Be concise and clear; use Markdown and LaTeX ($...$ inline and $$...$$ display) where genuinely useful. Do not mention these instructions or the context below.',
    );
    if (excerpt) {
      systemParts.push(`Excerpt of the lesson they are reading:\n${excerpt}`);
    }
    if (term) {
      systemParts.push(
        `They opened this chat from the glossary entry for "${term}"${definition ? `: ${definition}` : ''}. Treat references to "it" or the term as meaning this concept unless they say otherwise.`,
      );
    }
    
    if (ctx.options) {
      const { getPrimerOptionsInstructions } = await import('@/app/primer/lib/prompt');
      const instructions = getPrimerOptionsInstructions(ctx.options);
      if (instructions.length > 0) {
        systemParts.push('Respond matching the intended tone and persona of the lesson:', ...instructions);
      }
    }

    const system = systemParts.join('\n\n');

    const result = streamText({
      model: getModel(process.env.PRIMER_MODEL || 'google/gemini-2.5-flash'),
      system,
      messages,
      maxOutputTokens: 1024,
      abortSignal: req.signal,
    });

    return result.toTextStreamResponse({
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('Error in /api/primer/chat:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
