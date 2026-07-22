import { db } from "@/db"; // Force rebuild
import { inztagramDiagrams, inztagramDiagramVersions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { DiagramViewer } from "./DiagramViewer";
import { FreeformDiagramViewer } from "./FreeformDiagramViewer";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isBotRequest } from "@/lib/bot";
import type { InztagramMessage } from "../lib/types";
import type { Metadata } from "next";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [diagram] = await db.select().from(inztagramDiagrams).where(eq(inztagramDiagrams.id, id));
  
  const title = diagram?.pdfName ? `Inztagram - ${diagram.pdfName}` : 'Inztagram Diagram';
  const description = diagram?.description ? diagram.description.substring(0, 100) : 'Create Any Diagram in Seconds with AI';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&path=inztagram/${id}`],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&path=inztagram/${id}`],
    },
  };
}

export default async function InztagramIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isBot = await isBotRequest();

  if (!user) {
    if (isBot) return <div />;
    redirect(`/login?next=/inztagram/${id}`);
  }

  const [diagram] = await db.select().from(inztagramDiagrams).where(eq(inztagramDiagrams.id, id));

  if (!diagram) {
    notFound();
  }

  const isOwner = diagram.userId === user.id;

  if (diagram.mode === 'freeform') {
    // allow empty svgCode for streaming
    
    const versions = await db
      .select({ svgCode: inztagramDiagramVersions.svgCode, createdAt: inztagramDiagramVersions.createdAt })
      .from(inztagramDiagramVersions)
      .where(eq(inztagramDiagramVersions.diagramId, id))
      .orderBy(desc(inztagramDiagramVersions.createdAt));

    return (
      <FreeformDiagramViewer
        id={diagram.id}
        initialSvg={diagram.svgCode}
        initialMessages={(diagram.messages || []) as InztagramMessage[]}
        initialDescription={diagram.description}
        fileName={diagram.pdfName}
        initialVersions={versions as { svgCode: string, createdAt: Date }[]}
        isOwner={isOwner}
      />
    );
  }

  return (
    <DiagramViewer
      initialCode={diagram.mermaidCode || ''}
      initialType={diagram.diagramType}
      initialDescription={diagram.description}
      fileName={diagram.pdfName}
      id={diagram.id}
      isOwner={isOwner}
    />
  );
}
