import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { animacharts, animachartVersions } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized user' }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });
    }

    const { object: chartData } = await generateObject({
      model: openrouter(process.env.ANIMACHART_MODEL || 'gemini-2.5-flash'),
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
          content: [
            {
              type: 'text',
              text: "Analyze this chart image.\n1. Identify the primary chart type ('line', 'bar', 'pie', etc.). If it's a mix (e.g. bar and line), use 'mixed'.\n2. Determine orientation: if it is a horizontal bar chart, set orientation to 'horizontal'.\n3. For 'mixed' charts, specify the 'type' for each dataset ('line', 'bar', etc.). If it's an area chart, use type 'line' and we will fill it.\n4. Extract the title, x-axis labels, and exact data points. Estimate accurately if not explicit. Return a structured JSON."
            },
            {
              type: 'image',
              image: imageUrl
            }
          ]
        }
      ]
    });

    let insertedId: string | null = null;
    try {
      const [newChart] = await db.insert(animacharts).values({
        userId: user.id,
        imageUrl: imageUrl,
        chartData: chartData,
      }).returning({ id: animacharts.id });
      insertedId = newChart.id;

      await db.insert(animachartVersions).values({
        chartId: newChart.id,
        chartData: chartData,
      });
    } catch (dbError) {
      console.error('Failed to record animachart to DB:', dbError);
    }

    return NextResponse.json({
      id: insertedId,
      chartData: chartData,
    });
  } catch (error: any) {
    console.error('Error in /api/animachart:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
