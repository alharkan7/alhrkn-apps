import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { outlinerQueries, outlinerDrafts } from '@/db/schema';
import { eq, desc, inArray, or } from 'drizzle-orm';

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

    // 1. Fetch all drafts for this user first
    const allDrafts = await db
      .select()
      .from(outlinerDrafts)
      .where(eq(outlinerDrafts.userId, user.id))
      .orderBy(desc(outlinerDrafts.updatedAt));

    const draftQueryIds = Array.from(new Set(allDrafts.map(d => d.queryId).filter(Boolean))) as string[];

    // 2. Fetch queries: either owned by user OR referenced by their drafts
    let queriesQuery = db.select().from(outlinerQueries);
    if (draftQueryIds.length > 0) {
      queriesQuery = queriesQuery.where(
        or(
          eq(outlinerQueries.userId, user.id),
          inArray(outlinerQueries.id, draftQueryIds)
        )
      ) as any;
    } else {
      queriesQuery = queriesQuery.where(eq(outlinerQueries.userId, user.id)) as any;
    }

    const queries = await queriesQuery
      .orderBy(desc(outlinerQueries.updatedAt))
      .limit(limit)
      .offset(offset);

    const queryIds = queries.map(q => q.id);
    // drafts are already fetched in allDrafts

    const history = queries.map(q => {
      const draftsForQuery = allDrafts.filter(d => d.queryId === q.id).map(d => ({
        id: `/outliner/d/${d.id}`,
        title: d.title,
        type: 'draft',
        createdAt: d.createdAt,
      }));

      return {
        id: `/outliner/q/${q.id}`,
        title: q.keywords,
        type: 'query',
        createdAt: q.createdAt,
        drafts: draftsForQuery,
      };
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching outliner history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
