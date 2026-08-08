import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { posterlyPosters } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10) || 0);
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '50', 10) || 50));
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const history = await db.select({
      id: posterlyPosters.id,
      title: posterlyPosters.title,
      sourceFileName: posterlyPosters.sourceFileName,
      style: posterlyPosters.style,
      status: posterlyPosters.status,
      createdAt: posterlyPosters.createdAt,
    }).from(posterlyPosters)
      .where(eq(posterlyPosters.userId, user.id))
      .orderBy(desc(posterlyPosters.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(history);
  } catch (error) {
    console.error('[posterly] history failed:', error);
    return NextResponse.json({ error: 'Failed to fetch poster history' }, { status: 500 });
  }
}
