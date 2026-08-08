import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { posterlyPosters } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSignedUrl } from '@/lib/storage';
import { normalizePosterHtml, sanitizePosterHtml } from '@/app/posterly/lib/generator';

export const runtime = 'nodejs';
const MAX_EDITABLE_HTML_CHARS = 2_000_000;

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
      html: poster.html ? normalizePosterHtml(poster.html) : null,
      createdAt: poster.createdAt,
      updatedAt: poster.updatedAt,
      urls,
    });
  } catch (error) {
    console.error('[posterly] detail failed:', error);
    return NextResponse.json({ error: 'Failed to load poster' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null) as { html?: unknown; title?: unknown } | null;
    if (!body || typeof body.html !== 'string' || !body.html.trim()) {
      return NextResponse.json({ error: 'Poster HTML is required.' }, { status: 400 });
    }
    if (body.html.length > MAX_EDITABLE_HTML_CHARS) {
      return NextResponse.json({ error: 'Poster HTML is too large to save.' }, { status: 413 });
    }

    const html = normalizePosterHtml(sanitizePosterHtml(body.html));
    if (!/<html\b/i.test(html) || !/<body\b/i.test(html)) {
      return NextResponse.json({ error: 'Poster HTML must be a complete document.' }, { status: 400 });
    }

    const update: { html: string; title?: string; updatedAt: Date } = {
      html,
      updatedAt: new Date(),
    };
    if (body.title !== undefined) {
      if (typeof body.title !== 'string') {
        return NextResponse.json({ error: 'Poster title must be text.' }, { status: 400 });
      }
      const nextTitle = body.title.replace(/\s+/g, ' ').trim();
      if (!nextTitle || nextTitle.length > 180) {
        return NextResponse.json({ error: 'Poster title must be between 1 and 180 characters.' }, { status: 400 });
      }
      update.title = nextTitle;
    }

    const [updated] = await db.update(posterlyPosters)
      .set(update)
      .where(and(eq(posterlyPosters.id, id), eq(posterlyPosters.userId, user.id)))
      .returning({ id: posterlyPosters.id, title: posterlyPosters.title, updatedAt: posterlyPosters.updatedAt });

    if (!updated) return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[posterly] update failed:', error);
    return NextResponse.json({ error: 'Failed to save poster edits' }, { status: 500 });
  }
}
