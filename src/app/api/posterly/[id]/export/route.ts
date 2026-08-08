import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { posterlyPosters } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizePosterHtml } from '@/app/posterly/lib/generator';
import { renderPoster, type PosterExportFormat } from '@/app/posterly/lib/render';

export const runtime = 'nodejs';
export const maxDuration = 60;

function safeDownloadName(title: string): string {
  return (title || 'scientific-poster').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'scientific-poster';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let workDir: string | null = null;
  try {
    const format = new URL(request.url).searchParams.get('format') as PosterExportFormat | null;
    if (format !== 'pdf' && format !== 'png') {
      return NextResponse.json({ error: 'Export format must be pdf or png.' }, { status: 400 });
    }

    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const poster = await db.query.posterlyPosters.findFirst({
      where: and(eq(posterlyPosters.id, id), eq(posterlyPosters.userId, user.id)),
    });
    if (!poster) return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    if (!poster.html) return NextResponse.json({ error: 'This poster has no HTML source to export.' }, { status: 409 });

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'posterly-export-'));
    const rendered = await renderPoster(normalizePosterHtml(poster.html), workDir, format);
    const content = await fs.readFile(rendered.path);
    const baseName = safeDownloadName(poster.title);

    return new NextResponse(new Uint8Array(content), {
      headers: {
        'Content-Type': rendered.contentType,
        'Content-Disposition': `attachment; filename="${baseName}.${format}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[posterly] export failed:', error);
    return NextResponse.json({ error: 'Failed to export poster' }, { status: 500 });
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
