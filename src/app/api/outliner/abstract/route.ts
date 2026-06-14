import { NextRequest } from 'next/server';
import { getAuthUser, logOutlinerEvent } from '../logger';

// OpenAlex API base URL
const OPENALEX_API = 'https://api.openalex.org';

interface AbstractRequest {
  paperId: string;
}

interface AbstractResponse {
  paperId: string;
  abstract: string;
  title?: string;
}

// Cache for abstracts to avoid repeated API calls
const abstractCache = new Map<string, { result: AbstractResponse; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function fetchAbstractFromOpenAlex(paperId: string): Promise<AbstractResponse> {
  // Check cache first
  const cached = abstractCache.get(paperId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const maxRetries = 2;
  const baseDelay = 500;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Clean the paper ID - remove any URL prefixes
      const cleanId = paperId.replace(/^https?:\/\/openalex\.org\//, '');
      const workUrl = `${OPENALEX_API}/works/${cleanId}`;
      
      const params = new URLSearchParams({
        select: 'id,title,abstract_inverted_index'
      });

      const response = await fetch(`${workUrl}?${params}`, {
        headers: {
          'User-Agent': 'alhrkn-outliner/1.0 (https://github.com/alharkan7; mailto:alharkan7@gmail.com)',
          'From': 'alharkan7@gmail.com'
        }
      });

      if (response.status === 403) {
        console.warn('OpenAlex API returned 403 Forbidden for abstract request');
        throw new Error('Access denied to paper abstract');
      }

      if (response.status === 404) {
        throw new Error('Paper not found');
      }

      if (response.status === 429) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Rate limited (429), retrying abstract fetch in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          throw new Error('Rate limited by OpenAlex API');
        }
      }

      if (!response.ok) {
        throw new Error(`OpenAlex API error: ${response.status}`);
      }

      const data = await response.json();
      
      let abstract = '';
      if (data.abstract_inverted_index && typeof data.abstract_inverted_index === 'object') {
        // Convert inverted index to readable text
        abstract = reconstructAbstractFromInvertedIndex(data.abstract_inverted_index);
      }

      const result: AbstractResponse = {
        paperId: data.id || paperId,
        abstract: abstract || 'No abstract available for this paper.',
        title: data.title
      };

      // Cache the result
      abstractCache.set(paperId, { result, timestamp: Date.now() });
      return result;

    } catch (error) {
      if (attempt === maxRetries) {
        console.error('Error fetching abstract from OpenAlex after all retries:', error);
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Error on attempt ${attempt}, retrying abstract fetch in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Failed to fetch abstract after all retries');
}

function reconstructAbstractFromInvertedIndex(invertedIndex: Record<string, number[]>): string {
  try {
    // Create an array to hold words at their positions
    const words: string[] = [];
    
    // Process each word and its positions
    for (const [word, positions] of Object.entries(invertedIndex)) {
      if (Array.isArray(positions)) {
        for (const position of positions) {
          if (typeof position === 'number' && position >= 0) {
            words[position] = word;
          }
        }
      }
    }
    
    // Join the words, filtering out undefined positions
    const reconstructedText = words.filter(word => word !== undefined).join(' ');
    
    // Basic cleanup: ensure proper sentence capitalization and punctuation
    return reconstructedText
      .replace(/\s+/g, ' ') // Remove extra spaces
      .replace(/\s+([.!?])/g, '$1') // Remove spaces before punctuation
      .trim();
      
  } catch (error) {
    console.error('Error reconstructing abstract from inverted index:', error);
    return 'Error processing abstract text.';
  }
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

    const body: AbstractRequest = await req.json();
    const { paperId } = body;

    if (!paperId || typeof paperId !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Missing or invalid "paperId" parameter' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add small delay to prevent rapid-fire requests
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const abstractData = await fetchAbstractFromOpenAlex(paperId);

    await logOutlinerEvent(user.id, 'abstract', body, JSON.stringify(abstractData));

    return new Response(JSON.stringify(abstractData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in /api/outliner/abstract:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to fetch abstract';
    if (error?.message?.includes('Access denied')) {
      errorMessage = 'Access denied to paper abstract';
    } else if (error?.message?.includes('not found')) {
      errorMessage = 'Paper not found';
    } else if (error?.message?.includes('Rate limited')) {
      errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: error?.message?.includes('not found') ? 404 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}