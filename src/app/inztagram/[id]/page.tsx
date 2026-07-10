import { db } from "@/db"; // Force rebuild
import { inztagramDiagrams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DiagramViewer } from "./DiagramViewer";
import { FreeformDiagramViewer } from "./FreeformDiagramViewer";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InztagramMessage } from "../lib/types";

export default async function InztagramIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Viewing may still load; ownership enforced on edit API.
  }

  const [diagram] = await db.select().from(inztagramDiagrams).where(eq(inztagramDiagrams.id, id));

  if (!diagram) {
    notFound();
  }

  if (diagram.mode === 'freeform') {
    if (!diagram.svgCode) {
      notFound();
    }
    return (
      <FreeformDiagramViewer
        id={diagram.id}
        initialSvg={diagram.svgCode}
        initialMessages={(diagram.messages || []) as InztagramMessage[]}
        initialDescription={diagram.description}
        fileName={diagram.pdfName}
      />
    );
  }

  return (
    <DiagramViewer
      initialCode={diagram.mermaidCode || ''}
      initialType={diagram.diagramType}
      initialDescription={diagram.description}
      fileName={diagram.pdfName}
    />
  );
}
