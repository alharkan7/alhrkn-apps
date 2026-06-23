import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { flownotes } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await db
      .select({
        id: flownotes.id,
        title: flownotes.title,
        originalFileName: flownotes.originalFileName,
        aiPrompt: flownotes.aiPrompt,
        createdAt: flownotes.createdAt,
      })
      .from(flownotes)
      .where(eq(flownotes.userId, user.id))
      .orderBy(desc(flownotes.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching FlowNote history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
