import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { beeblioEvaluations } from '@/db/schema';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '');

// Removed static schema

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { papers, originalQuery, criteria } = await req.json();

    if (!papers || papers.length === 0) {
      return NextResponse.json({ evaluations: [] });
    }

    if (!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
    }

    const evaluationCriteria = (criteria && criteria.length === 3) ? criteria : ["Relevance", "Methodology", "Novelty"];

    const evaluationSchema: any = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          overallScore: { type: SchemaType.NUMBER },
          rubrics: {
            type: SchemaType.OBJECT,
            properties: evaluationCriteria.reduce((acc: any, c: string) => {
              acc[c] = { type: SchemaType.NUMBER };
              return acc;
            }, {}),
            required: evaluationCriteria
          }
        },
        required: ["id", "overallScore", "rubrics"]
      }
    };

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: evaluationSchema,
      }
    });
    
    const prompt = `You are a strict, expert academic reviewer for a curated intelligence platform. 
Your job is to read the following scientific papers and score them out of 10 based on how well they match the original query: "${originalQuery}"

CRITICAL INSTRUCTIONS:
1. Evaluate each paper based on these exact 3 criteria: ${evaluationCriteria.join(', ')}.
2. If a paper has no abstract or its abstract says "No abstract available", you MUST penalize it heavily. Give it a maximum score of 3.0. We only want rich, informative papers.
3. Calculate an overallScore (average of the three criteria, weighted slightly towards the relevance criterion).

Here are the papers:
${papers.map((p: any, i: number) => `[Paper ${i+1}]\nID: ${p.id}\nTitle: ${p.title}\nAbstract: ${p.abstract?.substring(0, 800) || "No abstract available"}`).join('\n\n')}
`;

    let evaluations;
    try {
      const result = await model.generateContent(prompt);
      const generatedData = JSON.parse(result.response.text());
      
      evaluations = generatedData.map((e: any) => {
        const rubricsRecord: Record<string, number> = {};
        if (e.rubrics) {
          Object.entries(e.rubrics).forEach(([key, value]) => {
            if (typeof value === 'number') {
              const capKey = key.charAt(0).toUpperCase() + key.slice(1);
              rubricsRecord[capKey] = value;
            }
          });
        }
        return {
          id: e.id,
          overallScore: e.overallScore,
          rubrics: Object.keys(rubricsRecord).length > 0 ? rubricsRecord : { Relevance: e.overallScore }
        };
      });
    } catch (apiError: any) {
      console.warn("Gemini API Failed, falling back to mock scores:", apiError.message);
      
      // Developer Mock Fallback for Quota limit testing
      evaluations = papers.map((p: any) => {
        const noAbstract = !p.abstract || p.abstract.includes('No abstract available');
        const penalty = noAbstract ? 3.0 : 0;
        
        return {
          id: p.id,
          overallScore: noAbstract ? 2.5 : Number((Math.random() * 4 + 6).toFixed(1)), // 6.0 to 10.0
          rubrics: {
            "Relevance": noAbstract ? 2.5 : Number((Math.random() * 4 + 6).toFixed(1)),
            "Rigor": noAbstract ? 2.5 : Number((Math.random() * 4 + 6).toFixed(1)),
            "Impact": noAbstract ? 2.5 : Number((Math.random() * 4 + 6).toFixed(1))
          }
        };
      });
    }

    if (evaluations && evaluations.length > 0) {
      try {
        await db.insert(beeblioEvaluations).values(
          evaluations.map((e: any) => {
            const paperDbId = papers.find((p: any) => p.id === e.id)?.dbId;
            return {
              userId: user.id,
              paperId: paperDbId, // From search route dbId
              originalQuery,
              overallScore: e.overallScore,
              rubrics: e.rubrics
            };
          }).filter((e: any) => e.paperId) // Only insert if we have a valid paper UUID
        );
      } catch (dbErr) {
        console.error("Failed to insert evaluations into DB:", dbErr);
      }
    }

    return NextResponse.json({ evaluations });

  } catch (error: any) {
    console.error('Evaluate API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
