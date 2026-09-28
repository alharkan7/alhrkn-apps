import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { autoLitSearches, autoLitFiles } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await db
      .select({
        id: autoLitSearches.id,
        originalQuery: autoLitSearches.originalQuery,
        contextText: autoLitSearches.contextText,
        fileName: autoLitFiles.fileName,
        createdAt: autoLitSearches.createdAt,
      })
      .from(autoLitSearches)
      .leftJoin(autoLitFiles, eq(autoLitSearches.id, autoLitFiles.searchId))
      .where(eq(autoLitSearches.userId, user.id))
      .orderBy(desc(autoLitSearches.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching Auto Lit history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
