import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { primerExplanations, primers } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isBotRequest } from '@/lib/bot';
import { PrimerLessonView } from '../components/PrimerLessonView';
import type { PrimerBreadcrumbItem } from '../components/PrimerBreadcrumbs';
import { mergeExplanations } from '../lib/parse';

export const dynamic = 'force-dynamic';

export default async function PrimerIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isBot = await isBotRequest();
  if (!user) {
    if (isBot) return <div />;
    redirect(`/login?next=/primer/${id}`);
  }

  const primer = await db.query.primers.findFirst({ where: eq(primers.id, id) });
  if (!primer || primer.userId !== user.id) {
    return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Lesson not found.</div>;
  }

  // Fold previously explained selections back in so they show up as underlined
  // glossary concepts on reload (they are saved without [[ ]] markers).
  const explanations = await db
    .select({
      selection: primerExplanations.selection,
      description: primerExplanations.description,
      occurrence: primerExplanations.occurrence,
      status: primerExplanations.status,
    })
    .from(primerExplanations)
    .where(and(
      eq(primerExplanations.primerId, id),
      eq(primerExplanations.userId, user.id),
    ));
  const { glossary, autoLinkTargets } = mergeExplanations(primer.glossary ?? [], explanations);

  const ancestorRows = await db.execute(sql`
    WITH RECURSIVE ancestor_rows AS (
      SELECT id, parent_id, title, topic, 0 AS depth
      FROM primers
      WHERE id = ${id} AND user_id = ${user.id}
      UNION ALL
      SELECT p.id, p.parent_id, p.title, p.topic, a.depth + 1
      FROM primers p
      INNER JOIN ancestor_rows a ON p.id = a.parent_id
      WHERE p.user_id = ${user.id} AND a.depth < 100
    )
    SELECT id, title, topic, depth
    FROM ancestor_rows
    ORDER BY depth DESC
  `) as unknown as Array<{ id: string; title: string | null; topic: string; depth: number }>;
  const breadcrumbs: PrimerBreadcrumbItem[] = ancestorRows.map((row, index) => ({
    id: row.id,
    title: row.title || row.topic,
    isCurrent: index === ancestorRows.length - 1,
  }));

  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Loading...</div>}>
      <PrimerLessonView
        id={primer.id}
        title={primer.title}
        topic={primer.topic}
        status={primer.status}
        content={primer.content}
        glossary={glossary}
        autoLinkTargets={autoLinkTargets}
        createdAt={primer.createdAt ? primer.createdAt.toISOString() : null}
        breadcrumbs={breadcrumbs}
      />
    </Suspense>
  );
}
