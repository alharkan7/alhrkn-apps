import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { primers } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [primer] = await db
      .select({
        id: primers.id,
        title: primers.title,
        topic: primers.topic,
        status: primers.status,
        content: primers.content,
        glossary: primers.glossary,
      })
      .from(primers)
      .where(and(eq(primers.id, id), eq(primers.userId, user.id)))
      .limit(1);

    if (!primer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(primer, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('Error in /api/primer/[id]:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
