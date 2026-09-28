import { Suspense } from 'react'
import AutoLitClient from '../components/AutoLitClient'
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { isBotRequest } from '@/lib/bot';
import { autoLitSearches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  let searchData = null;
  if (id !== 'new') {
    searchData = await db.query.autoLitSearches.findFirst({
      where: eq(autoLitSearches.id, id)
    });
  }

  const title = searchData?.originalQuery ? `Auto Lit - ${searchData.originalQuery}` : 'Auto Lit Search';
  const description = 'Experimental Apps by @alhrkn';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&path=auto-lit/${id}`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&path=auto-lit/${id}`],
    },
  };
}

export default async function AutoLitResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isBot = await isBotRequest();

  if (!user) {
    if (isBot) return <div />;
    redirect(`/login?next=/auto-lit/${resolvedParams.id}`);
  }

  let searchData = null;
  if (resolvedParams.id !== 'new') {
    searchData = await db.query.autoLitSearches.findFirst({
      where: eq(autoLitSearches.id, resolvedParams.id)
    });
  }

  const isOwner = resolvedParams.id === 'new' ? true : (searchData?.userId === user.id);

  return (
    <Suspense fallback={<div>Loading results...</div>}>
      <AutoLitClient pageId={resolvedParams.id} isOwner={isOwner} />
    </Suspense>
  )
}
