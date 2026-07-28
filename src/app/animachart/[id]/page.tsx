import { db } from "@/db";
import { animacharts, animachartVersions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isBotRequest } from "@/lib/bot";
import type { Metadata } from "next";
import { AnimatedChartViewer } from "./AnimatedChartViewer";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [diagram] = await db.select().from(animacharts).where(eq(animacharts.id, id));
  
  const title = diagram?.chartData ? `Motion Charts - ${(diagram.chartData as any).title}` : 'Motion Charts';
  const description = 'Turn Boring Graph into Animated Charts';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function AnimaChartIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const isBot = await isBotRequest();

  if (!user) {
    if (isBot) return <div />;
    redirect(`/login?next=/animachart/${id}`);
  }

  const [chartRecord] = await db.select().from(animacharts).where(eq(animacharts.id, id));

  if (!chartRecord || !chartRecord.chartData) {
    notFound();
  }

  const isOwner = chartRecord.userId === user.id;

  const versions = await db
    .select({ chartData: animachartVersions.chartData, createdAt: animachartVersions.createdAt })
    .from(animachartVersions)
    .where(eq(animachartVersions.chartId, id))
    .orderBy(desc(animachartVersions.createdAt));

  return (
    <AnimatedChartViewer
      id={chartRecord.id}
      initialData={chartRecord.chartData as any}
      initialVersions={versions as { chartData: any, createdAt: Date }[]}
    />
  );
}
