import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@/lib/google-ai-proxy';
import { Paper } from '@/app/beeblio/shared';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import { beeblioSearches, beeblioPapers, beeblioSettings, beeblioFiles } from '@/db/schema';
import { downloadFile } from '@/lib/storage';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

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
    semanticScholarQuery: { type: SchemaType.STRING, description: "Keyword search string tailored for Semantic Scholar" },
    evaluationCriteria: {
      type: SchemaType.ARRAY,
      description: "Exactly 3 short evaluation criteria names (max 2 words each) to score papers for this query. Always include 'Relevance' as one. Choose the other 2 based on intent, e.g. 'Historical Impact' for historical queries, 'Methodological Rigor' for methods queries, 'Novelty' for cutting-edge queries.",
      items: { type: SchemaType.STRING }
    }
  },
  required: ["openAlexQuery", "crossrefQuery", "semanticScholarQuery", "evaluationCriteria"]
};

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, aiOptimize, contextMode, databases = { openalex: true, crossref: true, semanticScholar: true }, page = 1, structuredQueries, searchId, attachmentUrl } = await req.json();

    let finalQueries = structuredQueries || {
      openAlexQuery: query,
      crossrefQuery: query,
      semanticScholarQuery: query
    };

    // AI Query Optimization + Dynamic Criteria Generation
    // Always run for new searches to generate dynamic evaluation criteria.
    // The aiOptimize toggle controls whether queries are rewritten or passed through verbatim.
    if (!structuredQueries && (process.env.GOOGLE_API_KEY)) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: process.env.BEEBLIO_SEARCH_MODEL || 'gemini-2.5-flash',
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: querySchema,
          }
        });
        let inlineDataPart: any = undefined;
        let additionalTextContext = '';

        if (attachmentUrl) {
          try {
            const bucketName = process.env.GOOGLE_CLOUD_BUCKET || '';
            const prefix = `https://storage.googleapis.com/${bucketName}/`;
            
            if (attachmentUrl.startsWith(prefix)) {
              const destination = attachmentUrl.slice(prefix.length);
              const buffer = await downloadFile(destination);
              const ext = destination.split('.').pop()?.toLowerCase() || '';

              if (['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
                let mimeType = 'application/pdf';
                if (ext === 'png') mimeType = 'image/png';
                if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                
                inlineDataPart = {
                  inlineData: {
                    data: buffer.toString('base64'),
                    mimeType
                  }
                };
              } else {
                // For markdown, txt, csv, etc, append directly to prompt text
                additionalTextContext = `\n\n--- ATTACHED DOCUMENT CONTENT ---\n${buffer.toString('utf8').substring(0, 100000)}`;
              }
            }
          } catch(e) {
            console.warn("Failed to download attachment for Gemini from GCS:", e);
          }
        }

        let promptText: string;
        if (contextMode) {
          promptText = `You are an expert academic librarian. Your job is to:\n1. Extract the 3-5 most critical keywords from the text below and the attached document (if any), and generate three tailored search queries:\n   - openAlexQuery: A precise boolean query (using AND/OR).\n   - crossrefQuery: A flat string of keywords (no boolean operators) best for Crossref.\n   - semanticScholarQuery: A short phrase or keywords for Semantic Scholar.\n2. Also determine the 3 most appropriate evaluation criteria (max 2 words each) for scoring papers returned by this search. Always include "Relevance" as one criterion.\n\nText: ${query.substring(0, 3000)}${additionalTextContext}`;
        } else if (aiOptimize) {
          promptText = `You are an expert academic librarian. Your job is to:\n1. Rewrite the user search into tailored queries for three databases:\n   - openAlexQuery: Strict, highly optimized boolean search (AND/OR).\n   - crossrefQuery: Flat keywords (no boolean operators) as Crossref fails with complex booleans.\n   - semanticScholarQuery: Keywords or short phrases.\n2. Also determine the 3 most appropriate evaluation criteria (max 2 words each) for scoring papers returned by this search. Always include "Relevance" as one criterion.\n\nInput: ${query.substring(0, 500)}`;
        } else {
          // Keywords mode, no optimization: pass query through verbatim, but still generate dynamic criteria
          promptText = `You are an expert academic librarian. A user searched for: "${query.substring(0, 500)}"\n\nYour job is to:\n1. Use the user's exact search terms as-is for all three database queries:\n   - openAlexQuery: Use the exact input.\n   - crossrefQuery: Use the exact input.\n   - semanticScholarQuery: Use the exact input.\n2. Determine the 3 most appropriate evaluation criteria (max 2 words each) for scoring papers returned by this search. Always include "Relevance" as one criterion. Choose the other 2 based on the user's likely intent from the keywords.`;
        }
        
        const promptParts: any[] = [promptText];
        if (inlineDataPart) promptParts.push(inlineDataPart);

        const result = await model.generateContent(promptParts);
        const parsed = JSON.parse(result.response.text());

        if (aiOptimize || contextMode) {
          // Use LLM-rewritten queries
          finalQueries = parsed;
        } else {
          // Keep original query, only take criteria from LLM
          finalQueries.evaluationCriteria = parsed.evaluationCriteria;
        }

        // Ensure evaluationCriteria is always present in finalQueries
        if (!finalQueries.evaluationCriteria || !Array.isArray(finalQueries.evaluationCriteria) || finalQueries.evaluationCriteria.length !== 3) {
          finalQueries.evaluationCriteria = ["Relevance", "Methodology", "Novelty"];
        }
      } catch (err: any) {
        console.warn('Query optimization failed, falling back to original query.', err.message);
        if (!query.trim() && contextMode) {
          throw new Error(`AI Optimization failed. Your Gemini API key might be out of quota or encountering an error: ${err.message}`);
        }
      }
    }

    const email = process.env.OPENALEX_EMAIL || '';
    const openAlexKey = process.env.OPENALEX_API_KEY || '';
    const s2Key = process.env.SEMANTIC_SCHOLAR_API_KEY || '';
    const itemsPerPage = 15;
    const offset = (page - 1) * itemsPerPage;

    // Ensure evaluationCriteria is set (either from AI optimization above, or from cached structuredQueries on pagination)
    if (!finalQueries.evaluationCriteria) {
      finalQueries.evaluationCriteria = ["Relevance", "Methodology", "Novelty"];
    }

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

    let currentSearchId = searchId;

    if (!currentSearchId) {
      const [searchRecord] = await db.insert(beeblioSearches).values({
        userId: user.id,
        originalQuery: query,
        contextText: contextMode ? query : null,
        databases,
        structuredQueries: finalQueries
      }).returning({ id: beeblioSearches.id });
      
      currentSearchId = searchRecord.id;

      // Save user settings specific to this search
      try {
        await db.insert(beeblioSettings).values({
          userId: user.id,
          searchId: currentSearchId,
          activeDatabases: databases,
          aiOptimize,
          aiReview: true,
          updatedAt: new Date()
        });
      } catch (e) {
        console.warn("Failed to save user settings:", e);
      }

      // Link attachment to this search
      if (attachmentUrl) {
        try {
          await db.update(beeblioFiles)
            .set({ searchId: currentSearchId })
            .where(eq(beeblioFiles.fileUrl, attachmentUrl));
        } catch (e) {
          console.warn("Failed to link file to search:", e);
        }
      }
    }

    let insertedPapers: any[] = [];
    if (allPapers.length > 0) {
      try {
        insertedPapers = await db.insert(beeblioPapers).values(
          allPapers.map(p => ({
            userId: user.id,
            searchId: currentSearchId,
            paperId: p.id,
            source: (p as any).database || p.source || 'Unknown',
            title: p.title,
            abstract: p.abstract,
            authors: p.authors,
            year: p.year,
            citations: p.citations,
            url: p.url,
          }))
        ).returning({ id: beeblioPapers.id, paperId: beeblioPapers.paperId });
      } catch (dbErr) {
        console.error("Failed to insert papers into DB:", dbErr);
      }
    }

    const papersToReturn = allPapers.map(p => {
      const dbRecord = insertedPapers.find(ip => ip.paperId === p.id);
      return {
        ...p,
        dbId: dbRecord?.id
      };
    });

    return NextResponse.json({ papers: papersToReturn, structuredQueries: finalQueries, searchId: currentSearchId });

  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
