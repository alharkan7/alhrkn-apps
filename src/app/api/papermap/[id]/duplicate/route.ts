import { NextRequest } from 'next/server';
import { db } from '@/db';
import { mindmaps, mindmapNodes } from '@/db/schema';
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
    
    // Fetch original mindmap
    const mindmapRecords = await db.select().from(mindmaps).where(eq(mindmaps.id, id)).limit(1);
    if (mindmapRecords.length === 0) {
      return new Response(JSON.stringify({ error: 'Mindmap not found' }), { status: 404 });
    }
    const originalMindmap = mindmapRecords[0];

    // Fetch original nodes
    const originalNodes = await db.select().from(mindmapNodes).where(eq(mindmapNodes.mindmapId, id));

    const newMindmapId = randomUUID();

    // Insert new mindmap
    await db.insert(mindmaps).values({
      id: newMindmapId,
      userId: user.id,
      title: `${originalMindmap.title} (Copy)`,
      inputType: originalMindmap.inputType,
      pdfUrl: originalMindmap.pdfUrl,
      fileName: originalMindmap.fileName,
      sourceUrl: originalMindmap.sourceUrl,
      isExample: originalMindmap.isExample,
      expiresAt: originalMindmap.expiresAt,
      parsed_pdf_content: originalMindmap.parsed_pdf_content,
    });

    // Insert nodes
    if (originalNodes.length > 0) {
      const newNodes = originalNodes.map(node => ({
        mindmapId: newMindmapId,
        nodeId: node.nodeId,
        title: node.title,
        description: node.description,
        parentId: node.parentId,
        level: node.level,
        pageNumber: node.pageNumber,
        positionX: node.positionX,
        positionY: node.positionY,
      }));
      await db.insert(mindmapNodes).values(newNodes);
    }

    return new Response(JSON.stringify({ newId: newMindmapId }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error duplicating mindmap:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), { status: 500 });
  }
}
