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
IMPORTANT: You MUST perfectly copy ALL existing properties of the current chart (especially 'orientation', 'type', 'title', and ALL properties inside 'datasets' like 'type', 'backgroundColor', 'borderColor', 'yAxisID') into your output. Modify ONLY the specific parts the user explicitly asked to change. Do NOT drop existing colors! If the chart has orientation: "horizontal", keep it.
RADIAL CHARTS: For pie and doughnut charts, preserve one dataset with one numeric value per slice. For sector-style polarArea charts, preserve one dataset; for polar-area images with multiple overlapping filled polygon layers around radial axes, preserve one numeric dataset per layer. Do not turn slices into bubble point objects. Preserve varied slice colors as a backgroundColor array when present.
RADAR CHARTS: Preserve type: 'radar', numeric arrays across the spoke/category labels, and tension: 0. Never convert a radar chart to type: 'line'.
LINE/AREA GEOMETRY: Preserve visibly sharp/cornered lines with tension: 0; only use positive tension when the source visibly has smooth curves.
MIXED CHARTS: If the chart is mixed, keep type: 'mixed' and preserve or explicitly set every dataset's type ('bar' or 'line'; use 'area' only when requested). Never omit dataset types for a mixed chart.
DUAL AXIS (For Mixed Charts): If the chart is a mixed chart with completely different scales, assign \`yAxisID: 'y'\` to every primary-range dataset and \`yAxisID: 'y1'\` to every secondary-range dataset. Use the exact axis IDs 'y' and 'y1'. Do not set animation to false or duration to 0.
ADVANCED OPTIONS: You can output a 'customOptions' object. It is deeply merged into the final Chart.js options. Use this for advanced settings like animations, grid settings, custom point styles, dashed borders, plugins, etc. Example: { customOptions: { animation: { duration: 5000, easing: 'easeInOutBounce' }, elements: { line: { borderDash: [5, 5] } } } }`;

    const { object: updatedChartData } = await generateObject({
      model: openrouter(process.env.ANIMACHART_MODEL || 'google/gemini-2.5-pro'),
      schema: z.object({
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
          tension: z.number().optional().describe("Line interpolation tension. Use 0 to preserve sharp/cornered lines, especially for radar, polygonal, or cornered area charts."),
          backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
          borderColor: z.union([z.string(), z.array(z.string())]).optional(),
          yAxisID: z.enum(['y', 'y1']).optional().describe("Use 'y' for the primary value axis and 'y1' for the secondary value axis when the chart has two different ranges."),
        })),
        customOptions: z.record(z.any()).optional().describe("Advanced Chart.js configuration options to override the defaults. Will be deeply merged into the chart options."),
      }),
      system: "You are an expert Chart.js JSON editing engine. Preserve all existing chart structure and dataset properties unless the user's request explicitly changes them. For pie and doughnut charts, keep one dataset with one numeric value per slice; for sector-style polarArea, keep one numeric dataset; for polygonal polar-area images with multiple overlapping filled layers, preserve one numeric dataset per layer. For radar charts, keep type 'radar', numeric datasets, and tension 0; never convert radar to line. Preserve varied radial colors as arrays. For line and area charts, preserve cornered geometry with tension 0 unless the source is visibly smooth. For mixed charts, keep type 'mixed' and explicitly retain every dataset type. For dual value ranges, use only y and y1 axis IDs and keep them on opposite sides. Never disable animation in customOptions.",
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
