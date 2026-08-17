import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { primers } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';
import type { PrimerOptions } from '@/app/primer/types';
import { and, eq } from 'drizzle-orm';

// Create a new Primer lesson row. Returns { id, title }. Streaming happens in
// /api/primer/[id]/generate so the [id] page can own the stream lifecycle.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
    if (!topic) {
      return NextResponse.json({ error: 'Missing topic' }, { status: 400 });
    }

    const rawOptions = body?.options && typeof body.options === 'object' ? body.options : {};
    const options: PrimerOptions = {
      audience: typeof rawOptions.audience === 'string' && rawOptions.audience.trim() ? rawOptions.audience.trim() : undefined,
      language: typeof rawOptions.language === 'string' && rawOptions.language.trim() ? rawOptions.language.trim() : undefined,
      length: ['brief', 'moderate', 'detailed'].includes(rawOptions.length) ? rawOptions.length : 'moderate',
      tone: typeof rawOptions.tone === 'string' && rawOptions.tone.trim() ? rawOptions.tone.trim() : 'general',
      context: typeof rawOptions.context === 'string' && rawOptions.context.trim() ? rawOptions.context.trim().slice(0, 1600) : undefined,
    };

    const rawParentId = typeof body?.parentId === 'string' ? body.parentId.trim() : '';
    const parentId = rawParentId || null;
    if (parentId) {
      const [parent] = await db
        .select({ id: primers.id })
        .from(primers)
        .where(and(eq(primers.id, parentId), eq(primers.userId, user.id)))
        .limit(1);
      if (!parent) return NextResponse.json({ error: 'Parent lesson not found' }, { status: 400 });
    }

    const id = nanoid(12);
    const title = topic.length > 60 ? topic.slice(0, 57).trimEnd() + '...' : topic;

    await db.insert(primers).values({
      id,
      userId: user.id,
      parentId,
      topic,
      title,
      options,
      status: 'pending',
      content: null,
      glossary: [],
    });

    return NextResponse.json({ id, title });
  } catch (error: any) {
    console.error('Error in /api/primer:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
