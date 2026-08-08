import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/db';
import { posterlyPosters } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSignedUrl } from '@/lib/storage';
import { PosterViewer } from '../components/PosterViewer';
import type { PosterStatus } from '../types';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const poster = await db.query.posterlyPosters.findFirst({ where: eq(posterlyPosters.id, id) });
  const title = poster?.title ? `Posterly — ${poster.title}` : 'Posterly — Scientific Posters';
  return { title, description: 'A source-grounded scientific poster generated from a paper.' };
}

export default async function PosterlyIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) redirect(`/login?next=/posterly/${id}`);

  const poster = await db.query.posterlyPosters.findFirst({
    where: and(eq(posterlyPosters.id, id), eq(posterlyPosters.userId, user.id)),
  });
  if (!poster) notFound();

  const urls: { html?: string; pdf?: string; png?: string } = {};
  if (poster.htmlPath) urls.html = await getSignedUrl(poster.htmlPath, { action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  if (poster.pdfPath) urls.pdf = await getSignedUrl(poster.pdfPath, { action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  if (poster.pngPath) urls.png = await getSignedUrl(poster.pngPath, { action: 'read', expires: Date.now() + 60 * 60 * 1000 });

  return (
    <PosterViewer
      id={poster.id}
      title={poster.title}
      style={poster.style}
      status={poster.status as PosterStatus}
      sourceFileName={poster.sourceFileName}
      initialUrls={urls}
      errorMessage={poster.errorMessage}
    />
  );
}
