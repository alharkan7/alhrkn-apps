import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { flownotes, flownoteEvents } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notes = await db.select()
      .from(flownotes)
      .where(eq(flownotes.userId, user.id))
      .orderBy(desc(flownotes.updatedAt));

    return NextResponse.json({ flownotes: notes });
  } catch (error) {
    console.error('Error fetching flownotes:', error);
    return NextResponse.json({ error: 'Failed to fetch flownotes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, nodes, edges, originalFileUrl, originalFileName, aiPrompt } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const [newFlowNote] = await db.insert(flownotes)
      .values({
        userId: user.id,
        title,
        nodes: nodes || [],
        edges: edges || [],
        originalFileUrl,
        originalFileName,
        aiPrompt,
      })
      .returning();

    // Log the creation event
    await db.insert(flownoteEvents).values({
      userId: user.id,
      flownoteId: newFlowNote.id,
      action: aiPrompt ? 'create_ai' : originalFileUrl ? 'create_import' : 'create_blank',
      inputPayload: JSON.stringify({ aiPrompt, originalFileName }),
    });

    return NextResponse.json({ flownote: newFlowNote });
  } catch (error) {
    console.error('Error creating flownote:', error);
    return NextResponse.json({ error: 'Failed to create flownote' }, { status: 500 });
  }
}
