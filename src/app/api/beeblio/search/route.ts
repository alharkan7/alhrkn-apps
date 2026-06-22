import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

export async function POST(req: Request) {
  try {
    const { query, aiOptimize, contextMode, databases = { openalex: true, crossref: true, semanticScholar: true } } = await req.json();

    let finalQuery = query;

    // AI Query Optimization
    if ((aiOptimize || contextMode) && (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = contextMode 
          ? `You are an expert academic librarian. Your ONLY job is to extract the 3-5 most critical keywords from the text below and format them as a concise boolean search query (using AND/OR) suitable for PubMed or OpenAlex. Do NOT output anything else. Do NOT output markdown or prefixes.\n\nText: ${query.substring(0, 3000)}`
          : `You are an expert academic librarian. Rewrite the user search into a strict, highly optimized boolean search query for a scientific database using AND/OR operators. Return ONLY the search query string without any markdown or quotes.\n\nInput: ${query.substring(0, 500)}`;
        
        const result = await model.generateContent(prompt);
        finalQuery = result.response.text().trim();
      } catch (err) {
        console.warn('Query optimization failed, falling back to original query.', err);
      }
    }

    const email = process.env.OPENALEX_EMAIL || '';
    const openAlexKey = process.env.OPENALEX_API_KEY || '';
    const s2Key = process.env.SEMANTIC_SCHOLAR_API_KEY || '';

    const fetchPromises = [];

    // 1. OpenAlex
    if (databases.openalex !== false) {
      fetchPromises.push((async () => {
        try {
          let url = `https://api.openalex.org/works?search=${encodeURIComponent(finalQuery)}&per-page=15`;
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
          const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(finalQuery)}&fields=title,authors,year,citationCount,venue,abstract,url&limit=15`;
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
          let url = `https://api.crossref.org/works?query=${encodeURIComponent(finalQuery)}&select=DOI,title,author,issued,is-referenced-by-count,container-title,abstract,URL&rows=15`;
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

    return NextResponse.json({ papers: allPapers, optimizedQuery: finalQuery });

  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
