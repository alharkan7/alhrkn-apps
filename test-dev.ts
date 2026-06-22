import { POST as SearchPOST } from './src/app/api/beeblio/search/route';
import { POST as EvalPOST } from './src/app/api/beeblio/evaluate/route';

async function testPipeline() {
  console.log("=== Testing Search API ===");
  const reqSearch = new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "Climate change effect on ocean acidification",
      aiOptimize: true,
      contextMode: false,
      databases: { openalex: true, crossref: false, semanticScholar: false }
    })
  });

  const resSearch = await SearchPOST(reqSearch);
  const dataSearch = await resSearch.json();
  console.log(`Optimized Query returned:`, dataSearch.optimizedQuery);
  console.log(`Papers found: ${dataSearch.papers?.length}`);

  if (dataSearch.papers?.length > 0) {
    console.log("\n=== Testing Evaluate API ===");
    // Pick first 5 papers
    const papersToEval = dataSearch.papers.slice(0, 5).map((p: any) => ({
      id: p.id, title: p.title, abstract: p.abstract
    }));

    const reqEval = new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        papers: papersToEval,
        originalQuery: "Climate change effect on ocean acidification"
      })
    });

    const resEval = await EvalPOST(reqEval);
    const dataEval = await resEval.json();
    console.log(`Evaluations returned:`, dataEval.evaluations?.length);
    if (dataEval.evaluations?.length > 0) {
      console.log(`First eval score:`, dataEval.evaluations[0].overallScore);
      console.log(`First eval rubrics:`, dataEval.evaluations[0].rubrics);
    }
  }
}

testPipeline().catch(console.error);
