import { NextResponse } from 'next/server';
import { db } from '@/db';
import { mindmaps } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await db.query.mindmaps.findMany({
      where: eq(mindmaps.userId, user.id),
      orderBy: [desc(mindmaps.createdAt)],
      limit: limit,
      offset: offset,
      columns: {
        id: true,
        title: true,
        inputType: true,
        createdAt: true,
      }
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching mindmap history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
