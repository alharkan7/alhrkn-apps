import { NextRequest } from 'next/server';
import { db } from '@/db';
import { flownotes } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    const { id } = await params;
    
    // Fetch original flownote
    const records = await db.select().from(flownotes).where(eq(flownotes.id, id)).limit(1);
    if (records.length === 0) {
      return new Response(JSON.stringify({ error: 'FlowNote not found' }), { status: 404 });
    }
    const original = records[0];

    const newId = randomUUID();

    // Insert new flownote
    await db.insert(flownotes).values({
      id: newId,
      userId: user.id,
      title: `${original.title} (Copy)`,
      nodes: original.nodes,
      edges: original.edges,
    });

    return new Response(JSON.stringify({ newId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error duplicating FlowNote:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
