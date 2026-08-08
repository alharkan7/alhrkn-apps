import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { posterlyPosters } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSignedUrl } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const poster = await db.query.posterlyPosters.findFirst({
      where: and(eq(posterlyPosters.id, id), eq(posterlyPosters.userId, user.id)),
    });
    if (!poster) return NextResponse.json({ error: 'Poster not found' }, { status: 404 });

    const urls: { html?: string; pdf?: string; png?: string } = {};
    if (poster.htmlPath) urls.html = await getSignedUrl(poster.htmlPath, { action: 'read', expires: Date.now() + 60 * 60 * 1000 });
    if (poster.pdfPath) urls.pdf = await getSignedUrl(poster.pdfPath, { action: 'read', expires: Date.now() + 60 * 60 * 1000 });
    if (poster.pngPath) urls.png = await getSignedUrl(poster.pngPath, { action: 'read', expires: Date.now() + 60 * 60 * 1000 });

    return NextResponse.json({
      id: poster.id,
      title: poster.title,
      sourceFileName: poster.sourceFileName,
      style: poster.style,
      status: poster.status,
      errorMessage: poster.errorMessage,
      html: poster.html,
      createdAt: poster.createdAt,
      updatedAt: poster.updatedAt,
      urls,
    });
  } catch (error) {
    console.error('[posterly] detail failed:', error);
    return NextResponse.json({ error: 'Failed to load poster' }, { status: 500 });
  }
}
