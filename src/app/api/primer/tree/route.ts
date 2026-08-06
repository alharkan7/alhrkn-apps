import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

interface RawTreeRow {
  id: string;
  parentId: string | null;
  title: string | null;
  topic: string;
  status: string;
  createdAt: string | Date | null;
  childCount: number | string;
  hasChildren: boolean;
}

function toNode(row: RawTreeRow) {
  return {
    id: row.id,
    parentId: row.parentId,
    title: row.title,
    topic: row.topic,
    status: row.status,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    childCount: Number(row.childCount) || 0,
    hasChildren: Boolean(row.hasChildren),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId')?.trim() || null;
    const forId = searchParams.get('ancestorsFor')?.trim() || null;
    const offsetValue = Number.parseInt(searchParams.get('offset') || '0', 10);
    const limitValue = Number.parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const offset = Number.isFinite(offsetValue) ? Math.max(0, offsetValue) : 0;
    const limit = Number.isFinite(limitValue) ? Math.min(MAX_LIMIT, Math.max(1, limitValue)) : DEFAULT_LIMIT;

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (forId) {
      const rows = await db.execute(sql`
        WITH RECURSIVE ancestor_rows AS (
          SELECT id, parent_id, title, topic, created_at, 0 AS depth
          FROM primers
          WHERE id = ${forId} AND user_id = ${user.id}
          UNION ALL
          SELECT p.id, p.parent_id, p.title, p.topic, p.created_at, a.depth + 1
          FROM primers p
          INNER JOIN ancestor_rows a ON p.id = a.parent_id
          WHERE p.user_id = ${user.id} AND a.depth < 100
        )
        SELECT id, parent_id AS "parentId", title, topic, created_at AS "createdAt", depth
        FROM ancestor_rows
        ORDER BY depth DESC
      `) as unknown as Array<RawTreeRow & { depth: number }>;

      return NextResponse.json({
        ancestors: rows.map((row) => ({
          id: row.id,
          parentId: row.parentId,
          title: row.title,
          topic: row.topic,
        })),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const parentFilter = parentId
      ? sql`p.parent_id = ${parentId}`
      : sql`p.parent_id IS NULL`;
    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.parent_id AS "parentId",
        p.title,
        p.topic,
        p.status,
        p.created_at AS "createdAt",
        (
          SELECT COUNT(*)::int
          FROM primers c
          WHERE c.parent_id = p.id AND c.user_id = ${user.id}
        ) AS "childCount",
        EXISTS (
          SELECT 1
          FROM primers c
          WHERE c.parent_id = p.id AND c.user_id = ${user.id}
        ) AS "hasChildren"
      FROM primers p
      WHERE p.user_id = ${user.id} AND ${parentFilter}
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `) as unknown as RawTreeRow[];

    return NextResponse.json({
      items: rows.map(toNode),
      parentId,
      offset,
      limit,
      hasMore: rows.length === limit,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Error in /api/primer/tree:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch Primer tree' }, { status: 500 });
  }
}
