import { NextRequest } from 'next/server';
import { db } from '@/db';
import { outlinerDrafts } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    const { id } = await params;
    
    // Fetch the original draft
    const draftRecords = await db
      .select()
      .from(outlinerDrafts)
      .where(eq(outlinerDrafts.id, id))
      .limit(1);

    if (draftRecords.length === 0) {
      return new Response(JSON.stringify({ error: 'Draft not found' }), { status: 404 });
    }

    const originalDraft = draftRecords[0];
    const newDraftId = nanoid(10);

    // Duplicate it
    await db.insert(outlinerDrafts).values({
      id: newDraftId,
      queryId: originalDraft.queryId,
      userId: user.id, // Set the current user as the new owner
      title: `${originalDraft.title} (Copy)`,
      abstract: originalDraft.abstract,
      content: originalDraft.content,
      language: originalDraft.language,
    });

    return new Response(JSON.stringify({ draftId: newDraftId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error duplicating draft:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
