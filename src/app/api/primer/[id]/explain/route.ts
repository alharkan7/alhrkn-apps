import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { primerExplanations, primers } from '@/db/schema';
import { getModel } from '@/lib/ai';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const STALE_EXPLANATION_MS = 2 * 60 * 1000;
const MAX_SELECTION_LENGTH = 500;

function normalizeSelection(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

async function getUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const selection = new URL(req.url).searchParams.get('selection')?.trim() || '';
    const selectionKey = normalizeSelection(selection);
    if (!selectionKey) return NextResponse.json({ error: 'Missing selection' }, { status: 400 });

    const [explanation] = await db
      .select({
        title: primerExplanations.title,
        description: primerExplanations.description,
        status: primerExplanations.status,
      })
      .from(primerExplanations)
      .where(and(
        eq(primerExplanations.primerId, id),
        eq(primerExplanations.userId, user.id),
        eq(primerExplanations.selectionKey, selectionKey),
      ))
      .limit(1);

    if (!explanation) return NextResponse.json({ error: 'Explanation not found' }, { status: 404 });
    return NextResponse.json(explanation, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Error in /api/primer/[id]/explain GET:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const [primer] = await db
      .select({ id: primers.id, topic: primers.topic })
      .from(primers)
      .where(and(eq(primers.id, id), eq(primers.userId, user.id)))
      .limit(1);
    if (!primer) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const selection = typeof body?.selection === 'string'
      ? body.selection.replace(/\s+/g, ' ').trim().slice(0, MAX_SELECTION_LENGTH)
      : '';
    const selectionKey = normalizeSelection(selection);
    if (!selectionKey) return NextResponse.json({ error: 'Missing selection' }, { status: 400 });

    const context = typeof body?.context === 'string' ? body.context.trim().slice(0, 1600) : '';
    const staleBefore = new Date(Date.now() - STALE_EXPLANATION_MS);
    let [existing] = await db
      .select()
      .from(primerExplanations)
      .where(and(
        eq(primerExplanations.primerId, id),
        eq(primerExplanations.userId, user.id),
        eq(primerExplanations.selectionKey, selectionKey),
      ))
      .limit(1);

    let ownsGeneration = false;
    if (!existing) {
      const [created] = await db
        .insert(primerExplanations)
        .values({
          id: nanoid(16),
          primerId: id,
          userId: user.id,
          selection,
          selectionKey,
          title: selection,
          status: 'generating',
        })
        .onConflictDoNothing({ target: [primerExplanations.primerId, primerExplanations.selectionKey] })
        .returning();
      if (created) {
        existing = created;
        ownsGeneration = true;
      } else {
        [existing] = await db
          .select()
          .from(primerExplanations)
          .where(and(
            eq(primerExplanations.primerId, id),
            eq(primerExplanations.userId, user.id),
            eq(primerExplanations.selectionKey, selectionKey),
          ))
          .limit(1);
      }
    }

    if (!existing) return NextResponse.json({ error: 'Could not create explanation' }, { status: 500 });
    if (existing.status === 'ready' && existing.description) {
      return NextResponse.json({ title: existing.title, description: existing.description, status: 'ready' });
    }

    const isRecent = existing.status === 'generating' && existing.updatedAt && existing.updatedAt > staleBefore;
    if (!ownsGeneration && isRecent) {
      return NextResponse.json({ status: 'generating' }, { status: 409 });
    }

    await db
      .update(primerExplanations)
      .set({ status: 'generating', description: null, updatedAt: new Date() })
      .where(eq(primerExplanations.id, existing.id));

    try {
      const result = await generateText({
        model: getModel(process.env.PRIMER_MODEL || 'google/gemini-2.5-flash'),
        system: 'You explain a selected passage from a learning lesson. Return only a concise, accurate 2–4 sentence explanation in plain text. Define the phrase in the lesson context, mention why it matters, and do not use a heading or preamble.',
        prompt: [
          `Selected phrase: ${selection}`,
          `Lesson topic: ${primer.topic}`,
          context ? `Nearby context:\n${context}` : '',
        ].filter(Boolean).join('\n\n'),
        maxOutputTokens: 320,
        abortSignal: req.signal,
      });
      const description = result.text.trim();
      if (!description) throw new Error('Explanation model returned empty text');

      await db
        .update(primerExplanations)
        .set({ description, status: 'ready', updatedAt: new Date() })
        .where(eq(primerExplanations.id, existing.id));

      return NextResponse.json({ title: selection, description, status: 'ready' });
    } catch (error) {
      await db
        .update(primerExplanations)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(primerExplanations.id, existing.id));
      throw error;
    }
  } catch (error: any) {
    console.error('Error in /api/primer/[id]/explain POST:', error);
    return NextResponse.json({ error: error?.message || 'Explanation failed' }, { status: 500 });
  }
}
