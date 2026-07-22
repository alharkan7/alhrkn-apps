import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Function to find the character indices of a statement in the original text
function findStatementIndices(originalText: string, statement: string): { start: number; end: number } | null {
  // First try exact match
  const exactIndex = originalText.indexOf(statement);
  if (exactIndex !== -1) {
    return {
      start: exactIndex,
      end: exactIndex + statement.length
    };
  }

  // If exact match fails, try with normalized whitespace
  const normalizedText = originalText.replace(/\s+/g, ' ').trim();
  const normalizedStatement = statement.replace(/\s+/g, ' ').trim();
  const normalizedIndex = normalizedText.indexOf(normalizedStatement);

  if (normalizedIndex !== -1) {
    // Find the corresponding position in original text
    const beforeNormalized = normalizedText.substring(0, normalizedIndex);
    const originalBeforeLength = beforeNormalized.length;

    // Count actual characters in original text up to this point
    let charCount = 0;
    let originalIndex = 0;

    while (charCount < originalBeforeLength && originalIndex < originalText.length) {
      if (originalText[originalIndex] !== ' ' || (originalIndex > 0 && originalText[originalIndex - 1] !== ' ')) {
        charCount++;
      }
      originalIndex++;
    }

    return {
      start: originalIndex,
      end: originalIndex + statement.length
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json(
        { error: 'Google API key not configured.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { text } = body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid "text" parameter' },
        { status: 400 }
      );
    }

    // Initialize Gemini with user's API key
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.DNANALYZER_MODEL || 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096,
      },
    });

const systemInstruction = `Extract statements with clear attribution from the text for discourse network analysis.

REQUIREMENTS:
- statement: Exact text (verbatim, no changes)
- concept: 2-5 words describing what the statement is about
- actor: Who said it (person, organization, or specific collective)
- organization: Organization associated with actor (empty string if none)
- agree: true/false/null (agreement/support=true, disagreement/criticism=false, neutral/factual=null)

EXTRACT statements with clear attribution including:
- Direct quotes: "John said, 'We must act now.'"
- Indirect attribution: "Indonesia's disaster agency says it is the deadliest disaster this year."
- Collective attribution: "Some officials said the foundation was unstable."
- Individual attribution: "Muhammad told reporters he heard falling rocks."

IGNORE unattributed statements like general facts or narrative.

Return ONLY a JSON array of statement objects.`;

const userPrompt = `Please analyze this text and extract all statements/discourse components:

"${text}"

Return ONLY the JSON structure with the statements array. Do not include any additional text or explanations.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemInstruction + '\n\n' + userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json'
      }
    });

    const responseText = result.response.text().trim();

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from response if it's wrapped in text
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return new Response(JSON.stringify({
            error: 'Failed to parse model response as JSON',
            raw: responseText,
            parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        return new Response(JSON.stringify({
          error: 'Failed to parse model response as JSON',
          raw: responseText,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle different response formats
    let statementsArray: any[] = [];

    if (Array.isArray(parsed)) {
      // Response is direct array of statements
      statementsArray = parsed;
    } else if (parsed?.statements && Array.isArray(parsed.statements)) {
      // Response is object with statements array
      statementsArray = parsed.statements;
    } else {
      return new Response(JSON.stringify({
        error: 'Model response missing statements array',
        raw: parsed,
        expectedFormat: 'Expected either an array of statements or { statements: [...] }'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate each statement has required fields and add position indices
    const validatedStatements = statementsArray
      .filter((stmt: any) => {
        return stmt &&
               typeof stmt.statement === 'string' &&
               typeof stmt.concept === 'string' &&
               typeof stmt.actor === 'string' &&
               typeof stmt.organization === 'string' &&
               (typeof stmt.agree === 'boolean' || stmt.agree === null);
      })
      .map((stmt: any) => {
        // Find the position of this statement in the original text
        const position = findStatementIndices(text, stmt.statement);
        return {
          ...stmt,
          startIndex: position?.start ?? -1,
          endIndex: position?.end ?? -1
        };
      });

    if (validatedStatements.length === 0 && statementsArray.length > 0) {
      return new Response(JSON.stringify({
        error: 'No valid statements found in response',
        raw: parsed,
        validationErrors: 'Each statement must have: statement (string), concept (string), actor (string), organization (string), agree (boolean or null)'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ statements: validatedStatements }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in /api/dnanalyzer:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
