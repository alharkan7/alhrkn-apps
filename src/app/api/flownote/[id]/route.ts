import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { flownotes, flownoteEvents } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { eq, and } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [flownote] = await db.select()
      .from(flownotes)
      .where(and(
        eq(flownotes.id, params.id),
        eq(flownotes.userId, user.id)
      ))
      .limit(1);

    if (!flownote) {
      return NextResponse.json({ error: 'FlowNote not found' }, { status: 404 });
    }

    return NextResponse.json({ flownote });
  } catch (error) {
    console.error('Error fetching flownote:', error);
    return NextResponse.json({ error: 'Failed to fetch flownote' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, nodes, edges } = body;

    const [updated] = await db.update(flownotes)
      .set({
        title,
        nodes,
        edges,
        updatedAt: new Date(),
      })
      .where(and(
        eq(flownotes.id, params.id),
        eq(flownotes.userId, user.id)
      ))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'FlowNote not found' }, { status: 404 });
    }

    // Log the edit event
    await db.insert(flownoteEvents).values({
      userId: user.id,
      flownoteId: updated.id,
      action: 'edit_flownote',
      inputPayload: JSON.stringify({ title, nodeCount: nodes?.length || 0, edgeCount: edges?.length || 0 }),
    });

    return NextResponse.json({ flownote: updated });
  } catch (error) {
    console.error('Error updating flownote:', error);
    return NextResponse.json({ error: 'Failed to update flownote' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [deleted] = await db.delete(flownotes)
      .where(and(
        eq(flownotes.id, params.id),
        eq(flownotes.userId, user.id)
      ))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'FlowNote not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting flownote:', error);
    return NextResponse.json({ error: 'Failed to delete flownote' }, { status: 500 });
  }
}
