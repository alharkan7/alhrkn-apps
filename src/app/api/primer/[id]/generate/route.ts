import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { getModel } from '@/lib/ai';
import { db } from '@/db';
import { primers } from '@/db/schema';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PRIMER_SYSTEM_PROMPT, buildPrimerUserPrompt } from '@/app/primer/lib/prompt';
import { splitPrimerMeta } from '@/app/primer/lib/parse';

const STALE_GENERATION_MS = 2 * 60 * 1000;

// Stream-generate a lesson for an existing row. Auth + ownership are checked
// before a status guard that prevents duplicate/concurrent generation. The final
// text is persisted before the stream is considered complete so a successful
// response cannot leave the row permanently in `generating`.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let claimedGeneration = false;
  let claimedId: string | null = null;
  let claimedUserId: string | null = null;

  try {
    const { id } = await params;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    const [primer] = await db
      .select()
      .from(primers)
      .where(and(eq(primers.id, id), eq(primers.userId, user.id)))
      .limit(1);

    if (!primer) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    // A generating row can be from another active tab, or it can be a crashed
    // request. Only reclaim the latter so reloads cannot create duplicate jobs.
    if (primer.status === 'ready') {
      return new Response(JSON.stringify({ error: 'Already generated', id }), { status: 409 });
    }
    const staleBefore = new Date(Date.now() - STALE_GENERATION_MS);
    const isRecentGeneration =
      primer.status === 'generating' &&
      primer.updatedAt != null &&
      primer.updatedAt > staleBefore;
    if (isRecentGeneration) {
      return new Response(JSON.stringify({ error: 'Generation in progress' }), { status: 409 });
    }

    // Atomically claim the row so concurrent callers/reloads don't double-generate.
    // The returning clause is important: a concurrent request must not continue
    // to the model unless it actually won the claim.
    const [claimed] = await db
      .update(primers)
      .set({ status: 'generating', updatedAt: new Date() })
      .where(
        and(
          eq(primers.id, id),
          eq(primers.userId, user.id),
          or(
            eq(primers.status, 'pending'),
            eq(primers.status, 'error'),
            and(
              eq(primers.status, 'generating'),
              or(isNull(primers.updatedAt), lt(primers.updatedAt, staleBefore)),
            ),
          ),
        ),
      )
      .returning({ id: primers.id });

    if (!claimed) {
      return new Response(JSON.stringify({ error: 'Generation in progress' }), { status: 409 });
    }
    claimedGeneration = true;
    claimedId = id;
    claimedUserId = user.id;

    const markGenerationError = async () => {
      try {
        await db
          .update(primers)
          .set({ status: 'error', updatedAt: new Date() })
          .where(and(eq(primers.id, id), eq(primers.userId, user.id)));
      } catch {}
    };

    const options = primer.options ?? {};

    const result = streamText({
      model: getModel(process.env.PRIMER_MODEL || 'google/gemini-2.5-flash'),
      system: PRIMER_SYSTEM_PROMPT,
      prompt: buildPrimerUserPrompt(primer.topic, options),
      maxOutputTokens: 16384,
      abortSignal: req.signal,
      onError: async ({ error }) => {
        console.error('primer stream error:', error);
        await markGenerationError();
      },
      onAbort: async () => {
        await markGenerationError();
      },
      onFinish: async ({ text }) => {
        try {
          if (!text.trim()) throw new Error('Primer model returned an empty lesson');
          const { body, meta } = splitPrimerMeta(text);
          await db
            .update(primers)
            .set({
              content: body,
              glossary: meta.glossary,
              title: meta.title ?? primer.title,
              status: 'ready',
              updatedAt: new Date(),
            })
            .where(and(eq(primers.id, id), eq(primers.userId, user.id)));
        } catch (e) {
          console.error('primer persist failed:', e);
          try {
            await db
              .update(primers)
              .set({ status: 'error', updatedAt: new Date() })
              .where(and(eq(primers.id, id), eq(primers.userId, user.id)));
          } catch {}
        }
      },
    });

    return result.toTextStreamResponse({
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('Error in /api/primer/[id]/generate:', error);
    // Cover synchronous failures after the row was claimed (for example an
    // invalid provider configuration) so the next visit can safely retry it.
    if (claimedGeneration && claimedId && claimedUserId) {
      try {
        await db
          .update(primers)
          .set({ status: 'error', updatedAt: new Date() })
          .where(and(eq(primers.id, claimedId), eq(primers.userId, claimedUserId)));
      } catch {}
    }
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
