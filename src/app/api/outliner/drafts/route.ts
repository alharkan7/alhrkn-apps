import { NextRequest } from 'next/server';
import { db } from '@/db';
import { outlinerDrafts } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { queryId, idea, language = 'en' } = body || {};

    if (!queryId || !idea || !idea.title) {
      return new Response(JSON.stringify({ error: 'Missing or invalid parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const draftId = nanoid(10);

    await db.insert(outlinerDrafts).values({
      id: draftId,
      queryId,
      userId: user.id,
      title: idea.title,
      abstract: idea.abstract,
      content: null, // Will be populated when expanded
      language,
    });

    return new Response(JSON.stringify({ draftId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/outliner/drafts:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
