import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { outlinerEvents } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';

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

    const events = await db
      .select({
        id: outlinerEvents.id,
        inputPayload: outlinerEvents.inputPayload,
        createdAt: outlinerEvents.createdAt,
      })
      .from(outlinerEvents)
      .where(and(eq(outlinerEvents.userId, user.id), eq(outlinerEvents.action, 'stream')))
      .orderBy(desc(outlinerEvents.createdAt))
      .limit(limit)
      .offset(offset);

    // Deduplicate by keywords
    const seen = new Set();
    const history = [];

    for (const event of events) {
      try {
        if (!event.inputPayload) continue;
        const payload = JSON.parse(event.inputPayload);
        const keywords = payload.keywords;
        if (!keywords || seen.has(keywords)) continue;
        
        seen.add(keywords);
        history.push({
          id: `?q=${encodeURIComponent(keywords)}`,
          title: keywords,
          createdAt: event.createdAt,
        });
      } catch (e) {
        continue;
      }
    }

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching outliner history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
