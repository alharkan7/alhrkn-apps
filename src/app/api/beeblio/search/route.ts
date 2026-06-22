import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { Paper } from '@/app/beeblio/shared';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '');

function invertAbstract(invertedIndex: Record<string, number[]>): string {
  if (!invertedIndex) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.filter(Boolean).join(' ');
}

const querySchema: any = {
  type: SchemaType.OBJECT,
  properties: {
    openAlexQuery: { type: SchemaType.STRING, description: "Boolean search query tailored for OpenAlex" },
    crossrefQuery: { type: SchemaType.STRING, description: "Flat keyword search string tailored for Crossref" },
    semanticScholarQuery: { type: SchemaType.STRING, description: "Keyword search string tailored for Semantic Scholar" }
  },
  required: ["openAlexQuery", "crossrefQuery", "semanticScholarQuery"]
};

export async function POST(req: Request) {
  try {
    const { query, aiOptimize, contextMode, databases = { openalex: true, crossref: true, semanticScholar: true }, page = 1, structuredQueries } = await req.json();

    let finalQueries = structuredQueries || {
      openAlexQuery: query,
      crossrefQuery: query,
      semanticScholarQuery: query
    };

    // AI Query Optimization
    if (!structuredQueries && (aiOptimize || contextMode) && (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: querySchema,
          }
        });
        const prompt = contextMode 
          ? `You are an expert academic librarian. Your ONLY job is to extract the 3-5 most critical keywords from the text below and generate three tailored search queries:\n1. openAlexQuery: A precise boolean query (using AND/OR).\n2. crossrefQuery: A flat string of keywords (no boolean operators) best for Crossref.\n3. semanticScholarQuery: A short phrase or keywords for Semantic Scholar.\n\nText: ${query.substring(0, 3000)}`
          : `You are an expert academic librarian. Rewrite the user search into tailored queries for three databases:\n1. openAlexQuery: Strict, highly optimized boolean search (AND/OR).\n2. crossrefQuery: Flat keywords (no boolean operators) as Crossref fails with complex booleans.\n3. semanticScholarQuery: Keywords or short phrases.\n\nInput: ${query.substring(0, 500)}`;
        
        const result = await model.generateContent(prompt);
        finalQueries = JSON.parse(result.response.text());
      } catch (err: any) {
        console.warn('Query optimization failed, falling back to original query.', err.message);
      }
    }

    const email = process.env.OPENALEX_EMAIL || '';
    const openAlexKey = process.env.OPENALEX_API_KEY || '';
    const s2Key = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
    const itemsPerPage = 15;
    const offset = (page - 1) * itemsPerPage;

    const fetchPromises = [];

    // 1. OpenAlex
    if (databases.openalex !== false) {
      fetchPromises.push((async () => {
        try {
          let url = `https://api.openalex.org/works?search=${encodeURIComponent(finalQueries.openAlexQuery)}&per-page=${itemsPerPage}&page=${page}`;
          if (email) url += `&mailto=${encodeURIComponent(email)}`;
          if (openAlexKey) url += `&api_key=${encodeURIComponent(openAlexKey)}`;
          
          const res = await fetch(url);
          if (!res.ok) throw new Error('OpenAlex error');
          const data = await res.json();
          
          return (data.results || []).map((work: any) => ({
            id: `openalex-${work.id.replace('https://openalex.org/', '')}`,
            title: work.title || 'Untitled',
            authors: (work.authorships || []).slice(0, 5).map((a: any) => a.author.display_name),
            year: work.publication_year || new Date().getFullYear(),
            citations: work.cited_by_count || 0,
            source: work.primary_location?.source?.display_name || 'OpenAlex',
            abstract: work.abstract_inverted_index ? invertAbstract(work.abstract_inverted_index) : 'No abstract available.',
            url: work.doi || work.id,
            database: 'OpenAlex'
          }));
        } catch (e) {
          console.warn("OpenAlex fetch failed:", e);
          return [];
        }
      })());
    }

    // 2. Semantic Scholar
    if (databases.semanticScholar !== false) {
      fetchPromises.push((async () => {
        try {
          const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(finalQueries.semanticScholarQuery)}&fields=title,authors,year,citationCount,venue,abstract,url&limit=${itemsPerPage}&offset=${offset}`;
          const headers: any = {};
          if (s2Key) headers['x-api-key'] = s2Key;
          
          const res = await fetch(url, { headers });
          if (!res.ok) throw new Error('S2 error');
          const data = await res.json();
          
          return (data.data || []).map((work: any) => ({
            id: `s2-${work.paperId}`,
            title: work.title || 'Untitled',
            authors: (work.authors || []).slice(0, 5).map((a: any) => a.name),
            year: work.year || new Date().getFullYear(),
            citations: work.citationCount || 0,
            source: work.venue || 'Semantic Scholar',
            abstract: work.abstract || 'No abstract available.',
            url: work.url || '',
            database: 'Semantic Scholar'
          }));
        } catch (e) {
          console.warn("Semantic Scholar fetch failed:", e);
          return [];
        }
      })());
    }

    // 3. Crossref
    if (databases.crossref !== false) {
      fetchPromises.push((async () => {
        try {
          let url = `https://api.crossref.org/works?query=${encodeURIComponent(finalQueries.crossrefQuery)}&select=DOI,title,author,issued,is-referenced-by-count,container-title,abstract,URL&rows=${itemsPerPage}&offset=${offset}`;
          if (email) url += `&mailto=${encodeURIComponent(email)}`;
          
          const res = await fetch(url);
          if (!res.ok) throw new Error('Crossref error');
          const data = await res.json();
          
          return (data.message?.items || []).map((work: any) => {
            let abstract = work.abstract ? work.abstract.replace(/<[^>]+>/g, '') : 'No abstract available.';
            return {
              id: `crossref-${work.DOI}`,
              title: work.title?.[0] || 'Untitled',
              authors: (work.author || []).slice(0, 5).map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()),
              year: work.issued?.['date-parts']?.[0]?.[0] || new Date().getFullYear(),
              citations: work['is-referenced-by-count'] || 0,
              source: work['container-title']?.[0] || 'Crossref',
              abstract: abstract,
              url: work.URL || `https://doi.org/${work.DOI}`,
              database: 'Crossref'
            };
          });
        } catch (e) {
          console.warn("Crossref fetch failed:", e);
          return [];
        }
      })());
    }

    const resultsArray = await Promise.all(fetchPromises);
    
    // Merge and deduplicate by title
    let allPapers: Paper[] = [];
    const seenTitles = new Set();
    
    resultsArray.flat().forEach(paper => {
      const normalizedTitle = paper.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seenTitles.has(normalizedTitle) && normalizedTitle.length > 5) {
        seenTitles.add(normalizedTitle);
        allPapers.push(paper);
      }
    });

    return NextResponse.json({ papers: allPapers, structuredQueries: finalQueries });

  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
