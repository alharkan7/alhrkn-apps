import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { animacharts, animachartVersions } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { sanitizeAnimachartCustomOptions } from '@/lib/animachart-sanitize';

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
            tension: z.number().optional().describe("Line interpolation tension. Use 0 to preserve sharp/cornered lines, especially for radar, polygonal, or cornered area charts."),
            backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
            borderColor: z.union([z.string(), z.array(z.string())]).optional(),
            yAxisID: z.enum(['y', 'y1']).optional().describe("Use 'y' for the primary value axis and 'y1' for the secondary value axis when the chart has two different ranges."),
          })),
          customOptions: z.record(z.any()).optional().describe("Advanced Chart.js configuration options to override the defaults. Will be deeply merged into the chart options."),
        }).optional(),
      }),
      system: "You are an expert chart-data extraction engine. Return only data that is faithful to the uploaded chart and valid for Chart.js 4. Mixed charts are special: preserve the chart as type 'mixed', explicitly type every dataset, and use only the axis IDs 'y' and 'y1' when two value ranges are present. For pie and doughnut charts, return one dataset containing one numeric value per slice/label, not one dataset per slice. For polarArea, use one dataset for wedge/sector-style charts; if the source visibly contains multiple overlapping filled polygon layers around radial axes, preserve one numeric dataset per layer so the viewer can render that polygonal polar style. For pie, doughnut, and sector-style polarArea, return a color array when the source has multiple slice colors. For radar charts, use type 'radar' with numeric datasets across spoke/category labels; do not downgrade radar to line, and set tension to 0 so polygon corners remain sharp. For line or area charts with visibly cornered geometry, set tension to 0. Static presentation labels are opt-in through the chart editor and must not be inferred during image extraction. Never disable animation in customOptions.",
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: "Analyze this image.\n1. Determine if it is a valid, supported chart. We support line, bar, pie, doughnut, radar, polarArea, mixed, bubble, and scatter charts. If it is a 3D chart, candlestick, map, or not a chart at all (e.g. a selfie, screenshot of text), set isSupportedChart to false and provide an errorReason.\n2. If it is a supported chart, set isSupportedChart to true and fill out chartConfig.\n3. Identify the primary chart type and orientation.\n4. Extract the title, x-axis labels, and exact data points.\n5. RADIAL CHARTS: A pie chart is a circle split into slices; a doughnut is the same with a center hole; a sector-style polarArea chart has separate radial sectors whose lengths vary. Use the exact type that matches the image. For pie, doughnut, and sector-style polarArea, output one dataset with one numeric value per label. For a polar-area image that visibly shows multiple overlapping filled polygon layers around radial axes, preserve one numeric dataset per layer instead of collapsing the layers. Do not use bubble point objects. Preserve varied slice colors in `backgroundColor` as an array when visible.\n6. RADAR CHARTS: A radar chart has spokes/categories radiating from a center and polygonal datasets. Set chartConfig.type to 'radar', output numeric arrays, and set `tension: 0`; do not represent it as a line chart.\n7. LINE/AREA GEOMETRY: Preserve visibly sharp/cornered lines with `tension: 0`; only use a positive tension when the source visibly has smooth curves.\n8. MIXED CHARTS: Set chartConfig.type to 'mixed'. Every dataset MUST include its own `type` ('bar' or 'line'; use 'area' only when the source clearly shows an area fill). Do not omit dataset types, because the viewer uses them to render the mixed chart.\n9. DUAL AXIS (For Mixed Charts): If the chart has completely different value ranges, assign `yAxisID: 'y'` to every primary-range dataset and `yAxisID: 'y1'` to every secondary-range dataset. Use the exact axis IDs 'y' and 'y1'.\n10. Do not set animation to false or duration to 0 in customOptions.\n11. ADVANCED: You can output a 'customOptions' object. It is deeply merged into the final Chart.js options. Example: { animation: { duration: 5000 }, elements: { line: { borderDash: [5, 5] } } }\nReturn a structured JSON."
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

    const chartData = {
      ...responseData.chartConfig,
      ...(responseData.chartConfig.customOptions === undefined
        ? {}
        : { customOptions: sanitizeAnimachartCustomOptions(responseData.chartConfig.customOptions) }),
    };

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
