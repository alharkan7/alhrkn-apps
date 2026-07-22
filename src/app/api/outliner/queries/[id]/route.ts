import { NextRequest } from 'next/server';
import { db } from '@/db';
import { outlinerQueries } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const queryRecords = await db
      .select()
      .from(outlinerQueries)
      .where(and(eq(outlinerQueries.id, id), eq(outlinerQueries.userId, user.id)))
      .limit(1);

    if (queryRecords.length === 0) {
      return new Response(JSON.stringify({ error: 'Query not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(queryRecords[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/outliner/queries/[id]:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
