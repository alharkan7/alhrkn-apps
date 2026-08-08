import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { posterlyPosters } from '@/db/schema';
import { getBucket } from '@/lib/storage/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { extractInputText, deriveSourceTitle, generatePosterHtml, titleFromPosterHtml } from '@/app/posterly/lib/generator';
import type { PosterStyle } from '@/app/posterly/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 100_000;
const POSTER_STYLES = new Set<PosterStyle>(['minimal', 'editorial', 'dark', 'blueprint']);

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'paper.md';
}

function contentTypeFor(fileName: string, fallback: string): string {
  if (/\.pdf$/i.test(fileName)) return 'application/pdf';
  if (/\.html?$/i.test(fileName)) return 'text/html; charset=utf-8';
  return fallback || 'text/markdown; charset=utf-8';
}

export async function POST(request: NextRequest) {
  let posterId: string | null = null;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const rawStyle = String(formData.get('style') || 'minimal');
    if (!POSTER_STYLES.has(rawStyle as PosterStyle)) {
      return NextResponse.json({ error: 'Unknown poster style' }, { status: 400 });
    }
    const style = rawStyle as PosterStyle;
    const rawFile = formData.get('file');
    const file = rawFile instanceof File ? rawFile : null;
    const textInput = typeof formData.get('text') === 'string' ? String(formData.get('text')) : '';

    if (!file && !textInput.trim()) {
      return NextResponse.json({ error: 'Provide a PDF, Markdown/text file, or paper text.' }, { status: 400 });
    }
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Input file must be 25 MB or smaller.' }, { status: 413 });
    }

    const sourceFileName = safeFileName(file?.name || 'paper.md');
    const sourceBuffer = file
      ? Buffer.from(await file.arrayBuffer())
      : Buffer.from(textInput.slice(0, MAX_TEXT_CHARS), 'utf8');
    const sourceText = file
      ? await extractInputText(sourceBuffer, file.type, sourceFileName)
      : textInput.slice(0, MAX_TEXT_CHARS).trim();
    if (sourceText.length < 20) {
      return NextResponse.json({ error: 'The paper input is too short to generate a useful poster.' }, { status: 400 });
    }

    const sourcePath = `posterly/${user.id}/${uuidv4()}-${sourceFileName}`;
    await getBucket().file(sourcePath).save(sourceBuffer, {
      contentType: contentTypeFor(sourceFileName, file?.type || 'text/markdown'),
      resumable: false,
      metadata: { userId: user.id, originalFileName: file?.name || 'paper.md' },
    });

    const sourceTitle = deriveSourceTitle(sourceText, sourceFileName);
    posterId = uuidv4();
    await db.insert(posterlyPosters).values({
      id: posterId,
      userId: user.id,
      title: sourceTitle,
      sourceFileName,
      sourceFilePath: sourcePath,
      style,
      status: 'processing',
    });

    const html = await generatePosterHtml(sourceText, sourceFileName, style);
    const title = titleFromPosterHtml(html, sourceTitle);
    await db.update(posterlyPosters).set({
      title,
      style,
      html,
      status: 'ready',
      errorMessage: null,
      updatedAt: new Date(),
    }).where(eq(posterlyPosters.id, posterId));

    return NextResponse.json({ id: posterId, title, style, status: 'ready' });
  } catch (error: any) {
    console.error('[posterly] generation failed:', error);
    if (posterId) {
      await db.update(posterlyPosters).set({
        status: 'error',
        errorMessage: error?.message || 'Poster generation failed',
        updatedAt: new Date(),
      }).where(eq(posterlyPosters.id, posterId)).catch((dbError) => {
        console.error('[posterly] failed to persist generation error:', dbError);
      });
    }
    return NextResponse.json({ error: error?.message || 'Failed to generate poster', id: posterId }, { status: 500 });
  }
}
