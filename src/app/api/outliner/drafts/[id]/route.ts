import { NextRequest } from 'next/server';
import { db } from '@/db';
import { outlinerDrafts } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const draftRecords = await db
      .select()
      .from(outlinerDrafts)
      .where(and(eq(outlinerDrafts.id, id), eq(outlinerDrafts.userId, user.id)))
      .limit(1);

    if (draftRecords.length === 0) {
      return new Response(JSON.stringify({ error: 'Draft not found' }), { status: 404 });
    }

    return new Response(JSON.stringify(draftRecords[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in GET /api/outliner/drafts/[id]:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const { content } = body || {};

    if (!content) {
      return new Response(JSON.stringify({ error: 'Missing content' }), { status: 400 });
    }

    // Verify ownership
    const draftRecords = await db
      .select()
      .from(outlinerDrafts)
      .where(and(eq(outlinerDrafts.id, id), eq(outlinerDrafts.userId, user.id)))
      .limit(1);

    if (draftRecords.length === 0) {
      return new Response(JSON.stringify({ error: 'Draft not found or unauthorized' }), { status: 404 });
    }

    await db.update(outlinerDrafts)
      .set({ content, updatedAt: new Date() })
      .where(eq(outlinerDrafts.id, id));

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in PUT /api/outliner/drafts/[id]:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
