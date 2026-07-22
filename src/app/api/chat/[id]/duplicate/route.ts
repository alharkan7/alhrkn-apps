import { NextRequest } from 'next/server';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
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
    
    // Fetch original chat session
    const original = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, id)
    });
    
    if (!original) {
      return new Response(JSON.stringify({ error: 'Chat session not found' }), { status: 404 });
    }

    const newId = randomUUID();

    // Insert new chat session
    await db.insert(chatSessions).values({
      id: newId,
      userId: user.id,
      title: `${original.title} (Copy)`,
      messages: original.messages,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return new Response(JSON.stringify({ newId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error duplicating chat session:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
