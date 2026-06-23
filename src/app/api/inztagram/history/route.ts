import { NextResponse } from 'next/server';
import { db } from '@/db';
import { inztagramDiagrams } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await db.query.inztagramDiagrams.findMany({
      where: eq(inztagramDiagrams.userId, user.id),
      orderBy: [desc(inztagramDiagrams.createdAt)],
      limit: limit,
      offset: offset,
      columns: {
        id: true,
        description: true,
        pdfName: true,
        diagramType: true,
        createdAt: true,
      }
    });

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching inztagram history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
