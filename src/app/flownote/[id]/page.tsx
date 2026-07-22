import FlowNoteApp from '../components/FlowNoteApp';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function FlowNoteIdPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/flownote/${resolvedParams.id}`);
  }

  return <FlowNoteApp key={resolvedParams.id} flownoteId={resolvedParams.id} />;
}
