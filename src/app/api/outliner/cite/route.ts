import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest } from 'next/server';
import { getAuthUser, logOutlinerEvent } from '../logger';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(apiKey);
// Schema for structured keyword extraction response
const keywordExtractionSchema = {
  type: 'object',
  properties: {
    keywords: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 6,
      description: 'Array of academic keywords extracted from the text'
    },
    searchQuery: {
      type: 'string',
      minLength: 1,
      description: 'Boolean search query using AND operators'
    }
  },
  required: ['keywords', 'searchQuery'],
  propertyOrdering: ['keywords', 'searchQuery']
};

// Initialize model without schema (will be set per request)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash-lite',
  generationConfig: {
    temperature: 0.1,
    topP: 0.8,
    topK: 20,
    maxOutputTokens: 200,
  },
});

// OpenAlex API base URL
const OPENALEX_API = 'https://api.openalex.org';

interface CitationRequest {
  text?: string;
  maxResults?: number; // deprecated
  perPage?: number;
  page?: number;
  searchQuery?: string;
}

interface KeywordExtractionResponse {
  keywords: string[];
  searchQuery: string;
}

interface OpenAlexWork {
  id: string;
  title: string;
  publication_year?: number;
  authorships?: Array<{
    author: {
      display_name: string;
      id?: string;
    };
  }>;
  primary_location?: {
    source?: {
      display_name?: string;
    };
    pdf_url?: string;
  };
  locations?: Array<{
    source?: {
      display_name?: string;
    };
    pdf_url?: string;
  }>;
  cited_by_count?: number;
  doi?: string;
  open_access?: {
    is_oa?: boolean;
    oa_url?: string;
  };
}

interface CitationResponse {
  keywords: string[];
  searchQuery: string;
  papers: OpenAlexWork[];
  totalFound: number;
  page: number;
  perPage: number;
}

// Client-side keyword extraction cache
const keywordCache = new Map<string, { result: KeywordExtractionResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Client-side fallback keyword extraction
function extractKeywordsClientSide(text: string): KeywordExtractionResponse {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['that', 'this', 'with', 'from', 'they', 'were', 'been', 'have', 'will', 'would', 'could', 'should', 'also', 'such', 'then', 'than', 'these', 'those', 'when', 'where', 'what', 'which', 'while'].includes(word))
    .slice(0, 4);
  
  // Ensure we always have at least one keyword
  if (words.length === 0) {
    const fallbackWords = text.split(/\s+/).filter(word => word.length > 2).slice(0, 3);
    return {
      keywords: fallbackWords.length > 0 ? fallbackWords : ['research'],
      searchQuery: fallbackWords.length > 0 ? fallbackWords.join(' AND ') : 'research'
    };
  }
  
  return {
    keywords: words,
    searchQuery: words.join(' AND ')
  };
}

async function extractKeywordsFromText(text: string): Promise<KeywordExtractionResponse> {
  // Check cache first
  const cacheKey = text.slice(0, 200).toLowerCase().trim();
  const cached = keywordCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  // Start with client-side extraction for immediate response
  const clientSideResult = extractKeywordsClientSide(text);
  
  const prompt = `You are an academic research assistant. Extract 3-4 relevant academic keywords from the following text for searching scholarly papers.

Text: "${text.slice(0, 300)}"

Instructions:
- Focus on technical, academic, and domain-specific terms
- Avoid common words like "research", "study", "analysis", "method"
- Extract noun phrases and key concepts
- Use simple space-separated terms for search (no quotes or AND operators)
- Prefer English terms when possible for better paper discovery

Return the result in JSON format with:
- keywords: array of 3-4 academic terms
- searchQuery: simple space-separated search terms`;

  try {
    // Create model with structured output for this specific request
    const structuredModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 20,
        maxOutputTokens: 200,
        responseMimeType: 'application/json',
        responseSchema: keywordExtractionSchema as any,
      },
    });

    const result = await structuredModel.generateContent(prompt);

    const responseText = result.response.text().trim();
    
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('Structured output JSON parse failed, using fallback. Response:', responseText.substring(0, 200), 'Error:', parseError);
      return clientSideResult;
    }

    // With structured output, the response should already be in the correct format
    // But we still validate to ensure data quality
    if (!parsed.keywords || !Array.isArray(parsed.keywords) || parsed.keywords.length === 0) {
      console.warn('Structured output missing or empty keywords, using fallback. Response:', JSON.stringify(parsed));
      return clientSideResult;
    }
    
    if (!parsed.searchQuery || typeof parsed.searchQuery !== 'string' || parsed.searchQuery.trim().length === 0) {
      console.warn('Structured output missing or empty searchQuery, using fallback. Response:', JSON.stringify(parsed));
      return clientSideResult;
    }

    // Clean and validate the keywords from structured output
    const cleanedKeywords = parsed.keywords
      .filter((keyword: any) => typeof keyword === 'string' && keyword.trim().length > 0)
      .map((keyword: any) => keyword.trim())
      .slice(0, 6); // Limit to 6 keywords max

    if (cleanedKeywords.length === 0) {
      console.warn('No valid keywords found in structured response, using fallback');
      return clientSideResult;
    }

    const validatedResult = {
      keywords: cleanedKeywords,
      searchQuery: parsed.searchQuery.trim()
    };

    // Cache the result
    keywordCache.set(cacheKey, { result: validatedResult, timestamp: Date.now() });
    return validatedResult;
  } catch (error) {
    console.error('Error extracting keywords:', error);
    // Return client-side result as fallback
    return clientSideResult;
  }
}

async function searchOpenAlex(query: string, perPage: number = 10, page: number = 1): Promise<{ results: OpenAlexWork[]; count: number; page: number; perPage: number; }> {
    const maxRetries = 2; // Reduced retries for faster response
    const baseDelay = 500; // Reduced base delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const searchUrl = `${OPENALEX_API}/works`;
            // Use simpler query without complex filtering for better results
            const params = new URLSearchParams({
                search: query,
                per_page: perPage.toString(),
                page: page.toString(),
                sort: 'cited_by_count:desc',
                select: 'id,title,publication_year,authorships,primary_location,locations,cited_by_count,doi,open_access'
            });

            const response = await fetch(`${searchUrl}?${params}`, {
                headers: {
                    'User-Agent': 'alhrkn-outliner/1.0 (https://github.com/alharkan7; mailto:alharkan7@gmail.com)',
                    'From': 'alharkan7@gmail.com'
                }
            });

            if (response.status === 403) {
                // Handle 403 Forbidden errors gracefully - don't retry
                console.warn('OpenAlex API returned 403 Forbidden - access denied');
                return { results: [], count: 0, page, perPage };
            }

            if (response.status === 429) {
                // Rate limited - wait and retry with exponential backoff
                if (attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    console.log(`Rate limited (429), retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    console.warn('Max retries reached for rate limiting');
                    return { results: [], count: 0, page, perPage };
                }
            }

            if (!response.ok) {
                throw new Error(`OpenAlex API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.results && Array.isArray(data.results)) {
                const count = typeof data?.meta?.count === 'number' ? data.meta.count : (data.results?.length || 0);
                return { results: data.results, count, page, perPage };
            } else {
                console.warn('Unexpected OpenAlex response format:', data);
                return { results: [], count: 0, page, perPage };
            }
        } catch (error) {
            if (attempt === maxRetries) {
                console.error('Error searching OpenAlex after all retries:', error);
                return { results: [], count: 0, page, perPage };
            }
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`Error on attempt ${attempt}, retrying in ${delay}ms:`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    return { results: [], count: 0, page, perPage };
}

// Helper function to convert OpenAlex work to the format expected by the frontend
function convertOpenAlexWorkToPaper(work: OpenAlexWork): any {
    // Abstract is no longer requested for faster response times
    let abstract = '';

    // Extract authors
    const authors = work.authorships?.map(authorship => ({
        name: authorship.author.display_name,
        authorId: authorship.author.id
    })) || [];

    // Extract venue from primary location or first location
    let venue = '';
    if (work.primary_location?.source?.display_name) {
        venue = work.primary_location.source.display_name;
    } else if (work.locations?.[0]?.source?.display_name) {
        venue = work.locations[0].source.display_name;
    }

    // Extract PDF URL
    let pdfUrl = '';
    if (work.primary_location?.pdf_url) {
        pdfUrl = work.primary_location.pdf_url;
    } else if (work.locations?.[0]?.pdf_url) {
        pdfUrl = work.locations[0].pdf_url;
    } else if (work.open_access?.oa_url) {
        pdfUrl = work.open_access.oa_url;
    }

    // Create URL from DOI if no direct URL available
    let url = '';
    if (work.doi) {
        url = `${work.doi}`;
    }

    return {
        paperId: work.id,
        title: work.title,
        abstract: abstract,
        year: work.publication_year,
        authors: authors,
        url: url,
        venue: venue,
        citationCount: work.cited_by_count || 0,
        openAccessPdf: pdfUrl ? { url: pdfUrl } : undefined
    };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: CitationRequest = await req.json();
    const { text, maxResults = 10, perPage: perPageRaw, page: pageRaw, searchQuery } = body;

    const perPage = Math.max(1, Math.min(25, Number(perPageRaw || maxResults || 10)));
    const page = Math.max(1, Number(pageRaw || 1));

    let keywordData: KeywordExtractionResponse;
    if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim().length > 0) {
      // Use provided search query; derive keywords heuristically
      const derivedKeywords = searchQuery.split(/\s+AND\s+/i).map(s => s.trim()).filter(Boolean);
      keywordData = { keywords: derivedKeywords, searchQuery };
    } else {
      if (!text || typeof text !== 'string') {
        return new Response(JSON.stringify({ 
          error: 'Missing or invalid "text" parameter' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (text.trim().length < 10) {
        return new Response(JSON.stringify({ 
          error: 'Text must be at least 10 characters long' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Extract keywords using Gemini
      keywordData = await extractKeywordsFromText(text);
    }
    
    // Add optimized delay to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Search for papers using the extracted/provided keywords
    const searchResult = await searchOpenAlex(keywordData.searchQuery, perPage, page);

    // Convert OpenAlex works to the format expected by the frontend
    const papers = searchResult.results.map(convertOpenAlexWorkToPaper);

    // Check if we got rate limited or no results
    if (papers.length === 0) {
      const warningMessage = 'No papers found. This may be due to rate limiting from OpenAlex API or no relevant papers available. Please try again in a few moments or select different text.';
      
      const responseJson = {
        keywords: keywordData.keywords,
        searchQuery: keywordData.searchQuery,
        papers: [],
        totalFound: 0,
        page,
        perPage,
        warning: warningMessage
      };

      await logOutlinerEvent(user.id, 'cite', body, JSON.stringify(responseJson));

      return new Response(JSON.stringify(responseJson), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response: CitationResponse = {
      keywords: keywordData.keywords,
      searchQuery: keywordData.searchQuery,
      papers: papers,
      totalFound: searchResult.count,
      page,
      perPage
    };

    await logOutlinerEvent(user.id, 'cite', body, JSON.stringify(response));

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in /api/outliner/cite:', error);
    return new Response(JSON.stringify({ 
      error: error?.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
