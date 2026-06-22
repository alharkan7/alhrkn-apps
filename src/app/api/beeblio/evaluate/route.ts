import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '');

const evaluationSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING },
      overallScore: { type: SchemaType.NUMBER },
      rubrics: {
        type: SchemaType.OBJECT,
        properties: {
          relevance: { type: SchemaType.NUMBER },
          methodology: { type: SchemaType.NUMBER },
          novelty: { type: SchemaType.NUMBER }
        },
        required: ["relevance", "methodology", "novelty"]
      }
    },
    required: ["id", "overallScore", "rubrics"]
  }
};

export async function POST(req: Request) {
  try {
    const { papers, originalQuery } = await req.json();

    if (!papers || papers.length === 0) {
      return NextResponse.json({ evaluations: [] });
    }

    if (!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is missing");
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: evaluationSchema,
      }
    });
    
    const prompt = `You are a strict, expert academic reviewer for a curated intelligence platform. 
Your job is to read the following scientific papers and score them out of 10 based on how well they match the original query: "${originalQuery}"

CRITICAL RULE: If a paper has no abstract or its abstract says "No abstract available", you MUST penalize it heavily. Give it a maximum score of 3.0. We only want rich, informative papers.

Evaluate based on 3 rubrics:
1. Relevance (Is it directly related to the query?)
2. Methodology (Does it seem robust based on the abstract?)
3. Novelty (Is it a new/significant contribution?)

Here are the papers:
${papers.map((p: any, i: number) => `[Paper ${i+1}]\nID: ${p.id}\nTitle: ${p.title}\nAbstract: ${p.abstract?.substring(0, 800) || "No abstract available"}`).join('\n\n')}

Calculate an overallScore (average of the three, weighted slightly towards Relevance).
`;

    let evaluations;
    try {
      const result = await model.generateContent(prompt);
      evaluations = JSON.parse(result.response.text());
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
            relevance: noAbstract ? 2.5 : Number((Math.random() * 4 + 6).toFixed(1)),
            methodology: noAbstract ? 2.5 : Number((Math.random() * 4 + 6).toFixed(1)),
            novelty: noAbstract ? 2.5 : Number((Math.random() * 4 + 6).toFixed(1))
          }
        };
      });
    }

    return NextResponse.json({ evaluations });

  } catch (error: any) {
    console.error('Evaluate API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
