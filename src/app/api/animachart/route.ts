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

    const { object: responseData } = await generateObject({
      model: openrouter(process.env.ANIMACHART_MODEL || 'gemini-2.5-flash'),
      schema: z.object({
        isSupportedChart: z.boolean().describe("True if the image is a valid chart of a supported type. False if it is not a chart, or if it is an unsupported type (e.g. 3D surface plot, map, candlestick)."),
        errorReason: z.string().optional().describe("If isSupportedChart is false, explain why (e.g. 'Image is not a chart', 'Unsupported chart type')."),
        chartConfig: z.object({
          type: z.enum(['line', 'bar', 'pie', 'doughnut', 'radar', 'polarArea', 'mixed', 'bubble', 'scatter']),
          orientation: z.enum(['vertical', 'horizontal']).optional(),
          title: z.string(),
          labels: z.array(z.string()),
          datasets: z.array(z.object({
            type: z.enum(['line', 'bar', 'area', 'bubble', 'scatter']).optional(),
            label: z.string(),
            data: z.array(z.union([
              z.number(),
              z.object({ x: z.number(), y: z.number(), r: z.number().optional() })
            ])),
            backgroundColor: z.string().optional(),
            borderColor: z.string().optional(),
            yAxisID: z.string().optional().describe("If using dual axes, specify 'y' for the first dataset and 'y1' for the second dataset."),
          })),
          customOptions: z.record(z.any()).optional().describe("Advanced Chart.js configuration options to override the defaults. Will be deeply merged into the chart options."),
        }).optional(),
      }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: "Analyze this image.\n1. Determine if it is a valid, supported chart. We support line, bar, pie, doughnut, radar, polarArea, mixed, bubble, and scatter charts. If it is a 3D chart, candlestick, map, or not a chart at all (e.g. a selfie, screenshot of text), set isSupportedChart to false and provide an errorReason.\n2. If it is a supported chart, set isSupportedChart to true and fill out chartConfig.\n3. Identify the primary chart type and orientation.\n4. Extract the title, x-axis labels, and exact data points.\n5. DUAL AXIS (For Mixed Charts): If the chart is a mixed chart with completely different scales, assign `yAxisID: 'y'` to the primary dataset and `yAxisID: 'y1'` to the secondary dataset. Then output `customOptions: { scales: { y: { type: 'linear', position: 'left' }, y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } } } }`.\n6. ADVANCED: You can output a 'customOptions' object. It is deeply merged into the final Chart.js options. Example: { animation: { duration: 5000 }, elements: { line: { borderDash: [5, 5] } } }\nReturn a structured JSON."
            },
            {
              type: 'image',
              image: imageUrl
            }
          ]
        }
      ]
    });

    if (!responseData.isSupportedChart || !responseData.chartConfig) {
      return NextResponse.json({ error: responseData.errorReason || "Image is not a supported chart." }, { status: 400 });
    }

    const chartData = responseData.chartConfig;

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
