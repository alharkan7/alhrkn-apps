import { Suspense } from 'react'
import BeeblioClient from '../components/BeeblioClient'
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { isBotRequest } from '@/lib/bot';
import { beeblioSearches } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function BeeblioResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isBot = await isBotRequest();

  if (!user) {
    if (isBot) return <div />;
    redirect(`/login?next=/beeblio/${resolvedParams.id}`);
  }

  const searchData = await db.query.beeblioSearches.findFirst({
    where: eq(beeblioSearches.id, resolvedParams.id)
  });

  const isOwner = searchData?.userId === user.id;

  return (
    <Suspense fallback={<div>Loading results...</div>}>
      <BeeblioClient pageId={resolvedParams.id} isOwner={isOwner} />
    </Suspense>
  )
}
