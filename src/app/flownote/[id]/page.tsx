import FlowNoteApp from '../components/FlowNoteApp';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { flownotes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [flownote] = await db.select().from(flownotes).where(eq(flownotes.id, id)).limit(1);
  
  const title = flownote?.title ? `FlowNote - ${flownote.title}` : 'FlowNote Document';
  const description = 'A Node-based Document Authoring System';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&path=flownote/${id}`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&path=flownote/${id}`],
    },
  };
}

export default async function FlowNoteIdPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/flownote/${resolvedParams.id}`);
  }

  const [flownote] = await db.select().from(flownotes).where(eq(flownotes.id, resolvedParams.id)).limit(1);

  if (!flownote) {
    notFound();
  }

  const isOwner = flownote.userId === user.id;

  return <FlowNoteApp key={resolvedParams.id} flownoteId={resolvedParams.id} isOwner={isOwner} />;
}
