import { NextRequest } from 'next/server';
import { db } from '@/db';
import { inztagramDiagrams, inztagramDiagramVersions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sanitizeSvg } from '@/app/inztagram/lib/sanitize-svg';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401 });
    }

    const { svg } = await req.json();
    if (!svg || typeof svg !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid SVG' }), { status: 400 });
    }

    let sanitizedSvg: string;
    try {
      sanitizedSvg = sanitizeSvg(svg);
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || 'Invalid SVG' }), { status: 400 });
    }

    const [diagram] = await db
      .select()
      .from(inztagramDiagrams)
      .where(and(eq(inztagramDiagrams.id, id), eq(inztagramDiagrams.userId, user.id)))
      .limit(1);

    if (!diagram) {
      return new Response(JSON.stringify({ error: 'Diagram not found' }), { status: 404 });
    }

    await db
      .update(inztagramDiagrams)
      .set({
        svgCode: sanitizedSvg,
        updatedAt: new Date(),
      })
      .where(and(eq(inztagramDiagrams.id, id), eq(inztagramDiagrams.userId, user.id)));

    await db.insert(inztagramDiagramVersions).values({
      diagramId: id,
      svgCode: sanitizedSvg,
      mermaidCode: null,
    });

    return new Response(JSON.stringify({ success: true, svg: sanitizedSvg }), { status: 200 });
  } catch (error: any) {
    console.error('Error saving SVG:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
