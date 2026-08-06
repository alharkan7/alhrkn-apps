import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const MAX_NODES = 200;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ error: 'Missing lesson id' }, { status: 400 });

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await db.execute(sql`
      WITH RECURSIVE connected AS (
        SELECT id, parent_id, title, topic, created_at, 0 AS distance
        FROM primers
        WHERE id = ${id} AND user_id = ${user.id}
        UNION
        SELECT p.id, p.parent_id, p.title, p.topic, p.created_at, c.distance + 1
        FROM primers p
        INNER JOIN connected c ON p.id = c.parent_id OR p.parent_id = c.id
        WHERE p.user_id = ${user.id} AND c.distance < 6
      )
      , distinct_nodes AS (
        SELECT DISTINCT ON (id)
          id,
          parent_id AS "parentId",
          title,
          topic,
          created_at AS "createdAt"
        FROM connected
        ORDER BY id, "createdAt" DESC
      )
      SELECT id, "parentId", title, topic, "createdAt"
      FROM distinct_nodes
      ORDER BY (id = ${id}) DESC, id
      LIMIT ${MAX_NODES}
    `) as unknown as Array<{
      id: string;
      parentId: string | null;
      title: string | null;
      topic: string;
      createdAt: string | Date | null;
    }>;

    if (rows.length === 0) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });

    return NextResponse.json({
      currentId: id,
      truncated: rows.length === MAX_NODES,
      nodes: rows.map((row) => ({
        id: row.id,
        parentId: row.parentId,
        title: row.title,
        topic: row.topic,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Error in /api/primer/graph:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch Primer graph' }, { status: 500 });
  }
}
