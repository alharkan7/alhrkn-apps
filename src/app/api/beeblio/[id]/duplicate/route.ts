import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { beeblioSearches, beeblioPapers, beeblioEvaluations } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
    }

    const { id } = await params;
    
    // Fetch original search
    const originalSearchRecords = await db.select().from(beeblioSearches).where(eq(beeblioSearches.id, id));
    if (!originalSearchRecords.length) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 });
    }
    const original = originalSearchRecords[0];

    const newId = randomUUID();

    // Insert new search session
    await db.insert(beeblioSearches).values({
      id: newId,
      userId: user.id,
      originalQuery: original.originalQuery,
      contextText: original.contextText,
      databases: original.databases,
      structuredQueries: original.structuredQueries,
      createdAt: new Date(),
    });

    // Fetch original papers
    const originalPapers = await db.select().from(beeblioPapers).where(eq(beeblioPapers.searchId, id));

    if (originalPapers.length > 0) {
      // Map papers to new searchId and generate new IDs
      const newPapers = originalPapers.map(p => ({
        id: randomUUID(),
        userId: user.id,
        searchId: newId,
        paperId: p.paperId,
        source: p.source,
        title: p.title,
        abstract: p.abstract,
        authors: p.authors,
        year: p.year,
        citations: p.citations,
        url: p.url,
        createdAt: new Date(),
        oldId: p.id // Keep track of old id to map evaluations
      }));

      const papersToInsert = newPapers.map(({ oldId, ...rest }) => rest);
      await db.insert(beeblioPapers).values(papersToInsert);

      // Fetch evaluations
      const originalEvaluations = await db.select().from(beeblioEvaluations).where(eq(beeblioEvaluations.userId, original.userId));
      
      const evalsToInsert = [];
      for (const newPaper of newPapers) {
        const oldEval = originalEvaluations.find(e => e.paperId === newPaper.oldId);
        if (oldEval) {
          evalsToInsert.push({
            id: randomUUID(),
            userId: user.id,
            paperId: newPaper.id, // Reference the new paper's ID
            overallScore: oldEval.overallScore,
            rubrics: oldEval.rubrics,
            createdAt: new Date(),
          });
        }
      }

      if (evalsToInsert.length > 0) {
        await db.insert(beeblioEvaluations).values(evalsToInsert);
      }
    }

    return NextResponse.json({ newId });
  } catch (error: any) {
    console.error('Error duplicating beeblio search:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
