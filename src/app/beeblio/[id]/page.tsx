import { Suspense } from 'react'
import BeeblioClient from '../components/BeeblioClient'
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function BeeblioResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/beeblio/${resolvedParams.id}`);
  }

  return (
    <Suspense fallback={<div>Loading results...</div>}>
      <BeeblioClient pageId={resolvedParams.id} />
    </Suspense>
  )
}
