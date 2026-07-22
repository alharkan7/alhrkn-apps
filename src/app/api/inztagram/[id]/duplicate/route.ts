import { NextRequest } from 'next/server';
import { db } from '@/db';
import { inztagramDiagrams, inztagramDiagramVersions } from '@/db/schema';
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
    
    // Fetch original diagram
    const diagramRecords = await db.select().from(inztagramDiagrams).where(eq(inztagramDiagrams.id, id)).limit(1);
    if (diagramRecords.length === 0) {
      return new Response(JSON.stringify({ error: 'Diagram not found' }), { status: 404 });
    }
    const originalDiagram = diagramRecords[0];

    // Fetch original versions
    const originalVersions = await db.select().from(inztagramDiagramVersions).where(eq(inztagramDiagramVersions.diagramId, id));

    const newDiagramId = randomUUID();

    // Insert new diagram
    await db.insert(inztagramDiagrams).values({
      id: newDiagramId,
      userId: user.id,
      mode: originalDiagram.mode,
      description: originalDiagram.description ? `${originalDiagram.description} (Copy)` : '(Copy)',
      diagramType: originalDiagram.diagramType,
      pdfUrl: originalDiagram.pdfUrl,
      pdfName: originalDiagram.pdfName,
      mermaidCode: originalDiagram.mermaidCode,
      svgCode: originalDiagram.svgCode,
      messages: originalDiagram.messages,
    });

    // Insert versions
    if (originalVersions.length > 0) {
      const newVersions = originalVersions.map(version => ({
        diagramId: newDiagramId,
        svgCode: version.svgCode,
        mermaidCode: version.mermaidCode,
        createdAt: version.createdAt,
      }));
      await db.insert(inztagramDiagramVersions).values(newVersions);
    }

    return new Response(JSON.stringify({ newId: newDiagramId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error duplicating diagram:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
