import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { beeblioSearches, beeblioPapers, beeblioEvaluations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: searchId } = await params;

    // Fetch Search
    const searchRecords = await db.select().from(beeblioSearches).where(eq(beeblioSearches.id, searchId));
    if (!searchRecords.length) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 });
    }
    const searchRecord = searchRecords[0];

    // Fetch Papers
    const papers = await db.select().from(beeblioPapers).where(eq(beeblioPapers.searchId, searchId));

    // Fetch Evaluations
    // Since evaluations are per paper, we can get all evaluations for the user for these papers
    // Or just all evaluations for this user that match the papers
    const evaluations = await db.select().from(beeblioEvaluations).where(eq(beeblioEvaluations.userId, user.id));

    // Map them to the frontend Paper format
    const mappedPapers = papers.map((p) => {
      const evalData = evaluations.find(e => e.paperId === p.id);
      return {
        id: p.paperId, // the external ID (e.g., openalex-W123)
        dbId: p.id,
        title: p.title,
        authors: p.authors,
        year: p.year,
        citations: p.citations,
        source: p.source,
        abstract: p.abstract,
        url: p.url,
        overallScore: evalData ? evalData.overallScore : null,
        rubrics: evalData && evalData.rubrics ? evalData.rubrics : null
      };
    });

    const payload = { 
      papers: mappedPapers, 
      structuredQueries: searchRecord.structuredQueries || null,
      searchId: searchRecord.id,
      isHistory: true
    };

    return NextResponse.json(JSON.parse(JSON.stringify(payload)));

  } catch (error: any) {
    console.error('Fetch Search History Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
