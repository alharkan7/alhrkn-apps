import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { NextRequest } from 'next/server';
import { DIAGRAM_TYPES } from '../../inztagram/components/diagram-types';
import { jsonrepair } from 'jsonrepair';
import { db } from '@/db';
import { inztagramDiagrams } from '@/db/schema';
import { createServerSupabaseClient } from '@/lib/supabase/server';

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8192,
  },
});

const REQUIREMENT_VERIF_METHODS_NOTE = `IMPORTANT: For requirementDiagram, the verifymethod field must be one of: analysis, demonstration, inspection, or test. Do NOT use any other value for verifymethod.`;

const STYLING_GUIDELINES = `Styling requirements:
- Produce clean, informative Mermaid diagrams with moderate styling that improves readability.
- Use Mermaid-native styling where supported: classDef, class, style, linkStyle, and clear subgraph/section titles.
- Use simple HTML tags in labels/text only when safely supported by the chosen diagram type (e.g., most flowcharts).
- For strict-syntax diagram types (such as gantt, journey, requirementDiagram, timeline, and pie), keep labels plain text and avoid HTML tags.
- Prefer restrained emphasis: highlight only key nodes/steps, not every element.
- Keep high contrast and legible labels; avoid excessive decoration.
- Never use script/style tags, inline event handlers, iframes, or external resources.
- Keep output fully valid Mermaid syntax for the selected diagram type.`;

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    diagramType: { type: SchemaType.STRING },
    code: { type: SchemaType.STRING }
  },
  required: ["diagramType", "code"]
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { description, diagramType, pdfUrl, pdfName } = body;
    if (!description && !pdfUrl) {
      return new Response(JSON.stringify({ error: 'Missing description or pdfUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build examples for the prompt
    let examplesSection = '';
    if (diagramType) {
      // Only the example for the selected type
      const found = DIAGRAM_TYPES.find(t => t.value === diagramType);
      if (found) {
        examplesSection = `Example (${found.label}):\n${found.example.trim()}`;
      }
    } else {
      // All examples
      examplesSection = DIAGRAM_TYPES.map(t => `Example (${t.label}):\n${t.example.trim()}`).join('\n\n');
    }

    // Add verifymethod note if type is requirementDiagram or not specified (auto)
    let verifymethodNote = '';
    if (!diagramType || diagramType === 'requirementDiagram') {
      verifymethodNote = `\n\n${REQUIREMENT_VERIF_METHODS_NOTE}`;
    }

    const SYSTEM_PROMPT = `You are an expert in Mermaid.js diagrams. Given a natural language description, output a JSON object with two fields: { "diagramType": string, "code": string }. The diagramType must be one of the following: [${DIAGRAM_TYPES.map(t => t.value).join(', ')}]. The code must be a valid Mermaid.js diagram, starting with the diagram type declaration (e.g., 'graph TD', 'timeline', etc.), as in the examples below. Do not include code fences or any extra text. Output ONLY the JSON object.\n\n${REQUIREMENT_VERIF_METHODS_NOTE}\n\n${STYLING_GUIDELINES}\n\n${examplesSection}`;

    let prompt;
    if (diagramType) {
      prompt = `Diagram type: ${diagramType}\nDescription: ${description || pdfName || 'PDF'}\n\nOutput ONLY a JSON object: {\n  "diagramType": "${diagramType}",\n  "code": "..."\n}\nThe code must be a valid Mermaid.js diagram, starting with the diagram type declaration (see example). Do not include code fences or any explanations.\n\nApply these style constraints:\n${STYLING_GUIDELINES}\n\n${examplesSection}${verifymethodNote}`;
    } else {
      prompt = `Description: ${description || pdfName || 'PDF'}\n\nChoose the best diagram type from this list: [${DIAGRAM_TYPES.map(t => t.value).join(', ')}]. Output ONLY a JSON object: {\n  "diagramType": "...",\n  "code": "..."\n}\nThe diagramType must be one of the allowed types. The code must be a valid Mermaid.js diagram, starting with the diagram type declaration (see examples). Do not include code fences or any explanations.\n\nApply these style constraints:\n${STYLING_GUIDELINES}\n\n${examplesSection}${verifymethodNote}`;
    }

    const contentParts: any[] = [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }];
    if (pdfUrl) {
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
      }
      const pdfBuffer = await pdfResponse.arrayBuffer();
      const base64Data = Buffer.from(pdfBuffer).toString('base64');
      contentParts.push({ inlineData: { mimeType: 'application/pdf', data: base64Data } });
    }

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: contentParts },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: responseSchema as any
      }
    });

    let responseText = result.response.text().trim();
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from text
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = JSON.parse(jsonrepair(match[0]));
        }
      } else {
        // Fallback: try jsonrepair on the whole string directly
        try {
          parsed = JSON.parse(jsonrepair(responseText));
        } catch {
          return new Response(JSON.stringify({ error: 'Failed to parse model response as JSON', raw: responseText }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
    // Validate diagramType
    const allowedTypes = DIAGRAM_TYPES.map(t => t.value);
    if (!parsed.diagramType || !allowedTypes.includes(parsed.diagramType)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing diagramType in model response', raw: responseText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Remove code cleaning logic that strips the diagram type declaration
    let code = parsed.code.trim();
    if (code.startsWith("```mermaid")) code = code.slice(9).trim();
    if (code.startsWith("```")) code = code.slice(3).trim();
    if (code.endsWith("```")) code = code.slice(0, -3).trim();
    // Do NOT strip the diagram type declaration anymore

    // Record to database
    let insertedId = null;
    try {
      const [newRecord] = await db.insert(inztagramDiagrams).values({
        userId: user.id,
        description: description || null,
        diagramType: parsed.diagramType,
        pdfUrl: pdfUrl || null,
        pdfName: pdfName || null,
        mermaidCode: code,
      }).returning({ id: inztagramDiagrams.id });
      insertedId = newRecord.id;
    } catch (dbError) {
      console.error('Failed to record diagram to DB:', dbError);
    }

    return new Response(JSON.stringify({ id: insertedId, code, diagramType: parsed.diagramType }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/inztagram:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 
