import { GoogleGenerativeAI } from '@/lib/google-ai-proxy';
import { NextRequest, NextResponse } from "next/server";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: process.env.FLOWNOTE_GENERATE_MODEL || 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 4096,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const systemInstruction = 'You are a creative content writer who helps create engaging, well-structured content in a node-based format.';
    
    const userPrompt = `Write a creative and engaging content about: "${prompt}".

Rules:
1. Tone: Casual, accessible, and engaging. Avoid stiff, academic, or overly formal language. Be conversational but not overly playful or silly.
2. Use Markdown headers (#, ##, ###) to represent the structure.
3. # is the Main Title (Root node).
4. ## are Main Sections (Child nodes). MUST prefix these with "Chapter [N]: " (e.g., Chapter 1: Introduction).
5. ### are Sub-sections. Do NOT prefix these with "Chapter".
6. Write full, interesting paragraphs for each section. Do not summarize or use bullet points excessively.
7. Do not use code blocks. Return raw markdown text.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemInstruction }] },
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 4096,
      }
    });

    const markdown = result.response.text();

    return NextResponse.json({ markdown });
  } catch (error: any) {
    console.error("AI Generation failed:", error);
    
    // Handle specific error types
    if (error?.status === 503) {
      return NextResponse.json(
        { error: "AI service is currently overloaded. Please try again in a moment." },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: error?.message || "Failed to generate content" },
      { status: 500 }
    );
  }
}

