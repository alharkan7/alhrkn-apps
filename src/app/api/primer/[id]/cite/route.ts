import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { primerCitations, primers } from '@/db/schema';
import { getModel } from '@/lib/ai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { jsonrepair } from 'jsonrepair';
import { extractSearchKeywords, searchAcademicPapers, toPrimerReference, type AcademicPaper } from '@/lib/academic-search';
import type { PrimerReference } from '@/app/primer/types';

const STALE_MS = 3 * 60 * 1000;
const MAX_SELECTION_LENGTH = 1000;
const MAX_PICKS = 3;
const MAX_CANDIDATES = 12;

function normalizeSelection(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

async function getUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Ask the model which of the candidate sources best back the passage, and to
 * write a short verdict. Returns indices into `candidates` (the model never
 * echoes metadata). Falls back to the top-cited candidate on any failure.
 */
async function verifyPassage(
  selection: string,
  topic: string,
  context: string,
  candidates: AcademicPaper[],
): Promise<{ verdict: string; references: PrimerReference[] }> {
  const fallback: { verdict: string; references: PrimerReference[] } = {
    verdict: 'No sources could be verified for this passage.',
    references: [],
  };
  if (candidates.length === 0) return fallback;

  const numbered = candidates.slice(0, MAX_CANDIDATES).map((p, i) => {
    const authors = p.authors.slice(0, 2).join(', ') + (p.authors.length > 2 ? ', et al.' : '');
    return `[${i}] ${authors} (${p.year ?? 'n.d.'}). ${p.title}${p.venue ? `. ${p.venue}` : ''}.${p.abstract ? ` ${p.abstract}` : ''}`;
  }).join('\n');

  const system = [
    'You are an academic reference librarian for an interactive textbook.',
    'Given a passage and candidate scholarly sources (with abstracts/TLDRs), pick the 1 to 3 that are the MOST relevant and authoritative for a reader who wants to verify or better understand the passage\'s claim.',
    'Academic sources rarely restate a textbook sentence; they are usually background or foundational works on the same topic, and that is exactly what you should select. Prefer sources whose topic closely matches the passage\'s core claim.',
    'Return ONLY JSON: {"verdict": string, "picks": [{"index": number}]}.',
    '"verdict": 2 to 4 plain sentences explaining how the chosen source(s) relate to and back up the passage, naming each by first author and year. Do not mention these instructions, the candidate list, or use phrases like "the text says".',
    '"picks": ranked by relevance, at most 3, using the bracketed candidate indices exactly. Only return picks: [] if NO candidate is even loosely related to the passage.',
  ].join('\n');

  const user = [
    `Lesson topic: ${topic}`,
    context ? `Nearby context: ${context}` : '',
    `Passage to verify:\n"""\n${selection}\n"""`,
    `Candidate sources:\n${numbered}`,
  ].filter(Boolean).join('\n\n');

  try {
    const { text } = await generateText({
      model: getModel(process.env.PRIMER_MODEL || 'google/gemini-2.5-flash'),
      system,
      prompt: user,
      maxOutputTokens: 700,
    });
    const parsed = JSON.parse(jsonrepair(text)) as { verdict?: unknown; picks?: unknown };
    const verdict = typeof parsed.verdict === 'string' && parsed.verdict.trim() ? parsed.verdict.trim() : '';
    const picks = Array.isArray(parsed.picks)
      ? parsed.picks
          .map((p: any) => (typeof p?.index === 'number' && Number.isInteger(p.index) ? p.index : null))
          .filter((i: number | null): i is number => i !== null && i >= 0 && i < candidates.length)
      : [];

    // De-dup and cap at MAX_PICKS, preserving the model's ranking.
    const unique = Array.from(new Set(picks)).slice(0, MAX_PICKS);
    const references = unique.map((i) => toPrimerReference(candidates[i])).filter(Boolean);
    if (references.length === 0) {
      return { verdict: verdict || fallback.verdict, references: [] };
    }
    return { verdict: verdict || 'This passage is supported by the cited source(s).', references };
  } catch {
    // Last resort: surface the single most-cited candidate.
    return {
      verdict: 'This passage is consistent with established literature; see the cited source.',
      references: [toPrimerReference(candidates[0])],
    };
  }
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

    const [row] = await db
      .select({ verdict: primerCitations.verdict, references: primerCitations.references, status: primerCitations.status })
      .from(primerCitations)
      .where(and(
        eq(primerCitations.primerId, id),
        eq(primerCitations.userId, user.id),
        eq(primerCitations.selectionKey, selectionKey),
      ))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'Citation not found' }, { status: 404 });
    return NextResponse.json(row, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Error in /api/primer/[id]/cite GET:', error);
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
    const occurrenceRaw = body?.occurrence;
    const occurrence = typeof occurrenceRaw === 'number' && Number.isInteger(occurrenceRaw) && occurrenceRaw >= 0 ? occurrenceRaw : null;

    const staleBefore = new Date(Date.now() - STALE_MS);
    let [existing] = await db
      .select()
      .from(primerCitations)
      .where(and(
        eq(primerCitations.primerId, id),
        eq(primerCitations.userId, user.id),
        eq(primerCitations.selectionKey, selectionKey),
      ))
      .limit(1);

    let ownsGeneration = false;
    if (!existing) {
      const [created] = await db
        .insert(primerCitations)
        .values({
          id: nanoid(16),
          primerId: id,
          userId: user.id,
          selection,
          selectionKey,
          occurrence,
          references: [],
          verdict: '',
          status: 'generating',
        })
        .onConflictDoNothing({ target: [primerCitations.primerId, primerCitations.selectionKey] })
        .returning();
      if (created) {
        existing = created;
        ownsGeneration = true;
      } else {
        [existing] = await db
          .select()
          .from(primerCitations)
          .where(and(
            eq(primerCitations.primerId, id),
            eq(primerCitations.userId, user.id),
            eq(primerCitations.selectionKey, selectionKey),
          ))
          .limit(1);
      }
    }

    if (!existing) return NextResponse.json({ error: 'Could not create citation' }, { status: 500 });
    if (existing.status === 'ready' && existing.references.length > 0) {
      return NextResponse.json({ verdict: existing.verdict, references: existing.references, status: 'ready' });
    }

    const isRecent = existing.status === 'generating' && existing.updatedAt && existing.updatedAt > staleBefore;
    if (!ownsGeneration && isRecent) {
      return NextResponse.json({ status: 'generating' }, { status: 409 });
    }

    await db
      .update(primerCitations)
      .set({ status: 'generating', references: [], verdict: '', updatedAt: new Date() })
      .where(eq(primerCitations.id, existing.id));

    try {
      const queries = await extractSearchKeywords(selection);
      const candidates = await searchAcademicPapers(queries);
      const { verdict, references } = await verifyPassage(selection, primer.topic, context, candidates);

      await db
        .update(primerCitations)
        .set({ verdict, references, status: 'ready', updatedAt: new Date() })
        .where(eq(primerCitations.id, existing.id));

      return NextResponse.json({ verdict, references, status: 'ready' });
    } catch (error) {
      await db
        .update(primerCitations)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(primerCitations.id, existing.id));
      throw error;
    }
  } catch (error: any) {
    console.error('Error in /api/primer/[id]/cite POST:', error);
    return NextResponse.json({ error: error?.message || 'Citation failed' }, { status: 500 });
  }
}
