import { db } from "@/db";
import { inztagramDiagrams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DiagramViewer } from "./DiagramViewer";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function InztagramIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // We could redirect, but viewing might be public or require auth. Let's let DiagramViewer load.
    // If it's private, we'd do a redirect here. For now, just continue.
  }

  const [diagram] = await db.select().from(inztagramDiagrams).where(eq(inztagramDiagrams.id, id));

  if (!diagram) {
    notFound();
  }

  return (
    <DiagramViewer 
      initialCode={diagram.mermaidCode}
      initialType={diagram.diagramType}
      initialDescription={diagram.description}
      fileName={diagram.pdfName}
    />
  );
}
