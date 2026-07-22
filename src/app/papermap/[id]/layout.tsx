import { db } from '@/db';
import { mindmaps } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const mindmap = await db.query.mindmaps.findFirst({ where: eq(mindmaps.id, id) });
  const title = mindmap?.title ? `Papermap - ${mindmap.title}` : 'Papermap - Interactive AI Mindmap';
  return {
    title,
    description: 'Learn Anything with Interactive AI Mindmap',
    openGraph: {
      title,
      description: 'Learn Anything with Interactive AI Mindmap',
      images: [`/api/og?title=${encodeURIComponent(title)}&description=Learn%20Anything%20with%20Interactive%20AI%20Mindmap&path=papermap/${id}`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: 'Learn Anything with Interactive AI Mindmap',
      images: [`/api/og?title=${encodeURIComponent(title)}&description=Learn%20Anything%20with%20Interactive%20AI%20Mindmap&path=papermap/${id}`],
    },
  };
}

export default function MindmapIdLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="w-full">
        {children}
      </main>
    </div>
  );
}