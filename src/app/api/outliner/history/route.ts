import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { outlinerQueries, outlinerDrafts } from '@/db/schema';
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

    const queries = await db
      .select()
      .from(outlinerQueries)
      .where(eq(outlinerQueries.userId, user.id))
      .orderBy(desc(outlinerQueries.updatedAt))
      .limit(limit)
      .offset(offset);

    // Fetch drafts for these queries
    const queryIds = queries.map(q => q.id);
    let allDrafts: any[] = [];
    
    if (queryIds.length > 0) {
      // Need to query drafts where queryId IN (queryIds)
      // Since drizzle-orm doesn't cleanly export `inArray` if not imported, we can fetch all for user or loop.
      allDrafts = await db
        .select()
        .from(outlinerDrafts)
        .where(eq(outlinerDrafts.userId, user.id))
        .orderBy(desc(outlinerDrafts.updatedAt));
    }

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
