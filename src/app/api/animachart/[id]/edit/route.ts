import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { animacharts, animachartVersions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
    }

    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    
    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const [chart] = await db
      .select()
      .from(animacharts)
      .where(and(eq(animacharts.id, id), eq(animacharts.userId, user.id)))
      .limit(1);

    if (!chart) {
      return NextResponse.json({ error: 'Chart not found' }, { status: 404 });
    }

    const priorMessages = (chart.messages || []) as any[];
    const recent = priorMessages.slice(-10);
    const historyBlock = recent
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = `You are a chart editing assistant.
You will be given the current JSON configuration for a Chart.js chart, and a user request to modify it.

Current Chart JSON:
${JSON.stringify(chart.chartData, null, 2)}

Conversation so far:
${historyBlock || '(none)'}

User Request:
${message}

CRITICAL INSTRUCTION: You MUST apply the changes requested by the user to the JSON data. DO NOT simply return the original JSON. 
IMPORTANT: You MUST preserve all existing properties of the current chart (such as 'orientation', 'type', 'title', 'colors', 'datasets') EXACTLY as they are, UNLESS the user's request explicitly requires changing them. If the current chart has orientation: "horizontal", your output MUST keep orientation: "horizontal" unless the user asks to change it.`;

    const { object: updatedChartData } = await generateObject({
      model: openrouter(process.env.ANIMACHART_MODEL || 'google/gemini-2.5-pro'),
      schema: z.object({
        type: z.enum(['line', 'bar', 'pie', 'doughnut', 'radar', 'polarArea', 'mixed']),
        orientation: z.enum(['vertical', 'horizontal']).optional(),
        title: z.string(),
        labels: z.array(z.string()),
        datasets: z.array(z.object({
          type: z.enum(['line', 'bar', 'area']).optional(),
          label: z.string(),
          data: z.array(z.number()),
          backgroundColor: z.string().optional(),
          borderColor: z.string().optional(),
        })),
      }),
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    console.log("OLD DATA:", JSON.stringify(chart.chartData, null, 2));
    console.log("NEW DATA:", JSON.stringify(updatedChartData, null, 2));

    const now = new Date().toISOString();
    const nextMessages = [
      ...priorMessages,
      { role: 'user', content: message, createdAt: now },
      { role: 'assistant', content: 'Updated the chart.', createdAt: now },
    ];

    await db
      .update(animacharts)
      .set({
        chartData: updatedChartData,
        messages: nextMessages,
        updatedAt: new Date(),
      })
      .where(and(eq(animacharts.id, id), eq(animacharts.userId, user.id)));

    // Insert new version
    await db.insert(animachartVersions).values({
      chartId: id,
      chartData: updatedChartData,
    });

    return NextResponse.json({
      chartData: updatedChartData,
      messages: nextMessages,
    });
  } catch (error: any) {
    console.error('Error in /api/animachart/[id]/edit:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
