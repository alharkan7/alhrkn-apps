from __future__ import annotations

import json
import logging
import os

from google import genai
from google.genai import types

from .models import BatchEvaluation, EvaluationResult, PaperMetadata

logger = logging.getLogger(__name__)

MAX_GEMINI_REQUESTS = 50

EVALUATION_SYSTEM_PROMPT = """\
You are a VERY STRICT academic relevance evaluator performing a literature review. \
You will receive a user's specific research context and a batch of candidate papers. \
For EACH paper you must decide if it is DIRECTLY and SUBSTANTIVELY relevant.

CRITICAL RULES — read carefully:
1. First, mentally identify the user's CORE research topic, theoretical frameworks, \
and specific domain. Do NOT rely on surface-level keyword overlap.
2. A paper is relevant ONLY if it directly contributes to the user's specific \
research question, theoretical framework, methodology, or empirical domain. \
It must be something a researcher would actually cite in a literature review \
on this exact topic.
3. REJECT papers that merely share a keyword but study a completely different subject. \
For example, if the research is about "viral social media content influencing policy," \
reject papers about biological viruses, epidemics, or disease surveillance — \
even if they mention "Indonesia" or "policy."
4. REJECT papers from unrelated disciplines (e.g., medical/health papers for a \
political science/communication topic) unless they are genuinely cross-disciplinary \
and directly address the user's research.
5. REJECT papers that are only tangentially related (e.g., generic "social media" \
studies that do not address the user's specific governance/policy/activism angle).
6. When in doubt, REJECT. A false negative (missing a borderline paper) is far \
better than a false positive (including an irrelevant paper).

Return a JSON array where each element has: \
"openalex_id", "title", "is_relevant" (boolean), "rationale" (string, 1-2 sentences).
"""


def _format_paper_for_prompt(paper: PaperMetadata) -> str:
    abstract_snippet = (paper.abstract or "N/A")[:600]
    concepts_str = ", ".join(paper.concepts[:5]) if paper.concepts else "N/A"
    return (
        f"  ID: {paper.openalex_id}\n"
        f"  Title: {paper.title}\n"
        f"  Year: {paper.publication_year or 'N/A'}\n"
        f"  Citations: {paper.cited_by_count}\n"
        f"  Topic: {paper.primary_topic or 'N/A'}\n"
        f"  Concepts: {concepts_str}\n"
        f"  Source: {paper.source_name or 'N/A'}\n"
        f"  Authors: {', '.join(paper.authors[:3]) or 'N/A'}\n"
        f"  Institutions: {', '.join(paper.institutions[:3]) or 'N/A'}\n"
        f"  Abstract: {abstract_snippet}\n"
    )


class GeminiEvaluator:
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required. "
                "Set it in the Streamlit sidebar or as an environment variable."
            )
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name
        self.request_count = 0
        self.max_requests = MAX_GEMINI_REQUESTS

    @property
    def limit_reached(self) -> bool:
        return self.request_count >= self.max_requests

    def _generate(self, prompt: str, system_instruction: str | None = None) -> str:
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.1,
        )
        if system_instruction:
            config.system_instruction = system_instruction

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=config,
        )
        return response.text

    def evaluate_batch(
        self, user_context: str, papers: list[PaperMetadata]
    ) -> BatchEvaluation:
        if self.limit_reached:
            logger.warning("Gemini request safety limit reached (%d)", self.max_requests)
            return BatchEvaluation(evaluations=[])

        if not papers:
            return BatchEvaluation(evaluations=[])

        papers_block = "\n---\n".join(
            f"Paper {i + 1}:\n{_format_paper_for_prompt(p)}"
            for i, p in enumerate(papers)
        )

        prompt = (
            f"## User Research Context\n{user_context}\n\n"
            "## TASK\n"
            "First, in one sentence, state the user's CORE research topic. "
            "Then evaluate each paper below against that core topic.\n\n"
            f"## Papers to Evaluate ({len(papers)} total)\n{papers_block}\n\n"
            "Return a JSON array of objects with keys: "
            '"openalex_id", "title", "is_relevant", "rationale". '
            "Remember: when in doubt, mark is_relevant as false."
        )

        try:
            text = self._generate(prompt, system_instruction=EVALUATION_SYSTEM_PROMPT)
            self.request_count += 1
            return self._parse_response(text, papers)
        except Exception as exc:
            logger.error("Gemini evaluation failed: %s", exc)
            self.request_count += 1
            return BatchEvaluation(evaluations=[])

    def _parse_response(
        self, response_text: str, papers: list[PaperMetadata]
    ) -> BatchEvaluation:
        try:
            raw = json.loads(response_text)
            if not isinstance(raw, list):
                raw = raw.get("evaluations", raw.get("results", []))

            paper_map = {p.openalex_id: p for p in papers}
            evaluations: list[EvaluationResult] = []

            for item in raw:
                oa_id = item.get("openalex_id", "")
                title = item.get("title", "")
                if not title and oa_id in paper_map:
                    title = paper_map[oa_id].title
                evaluations.append(
                    EvaluationResult(
                        openalex_id=oa_id,
                        title=title,
                        is_relevant=bool(item.get("is_relevant", False)),
                        rationale=item.get("rationale", "No rationale provided."),
                    )
                )
            return BatchEvaluation(evaluations=evaluations)
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            logger.error("Failed to parse Gemini response: %s", exc)
            return BatchEvaluation(evaluations=[])

    def extract_queries(self, research_context: str) -> list[str]:
        """Use Gemini to extract search queries from a longer research context."""
        if self.limit_reached:
            return []

        prompt = (
            "You are an expert research librarian helping a scholar find academic papers "
            "in the OpenAlex database. OpenAlex uses full-text search — it matches query "
            "words against titles, abstracts, and concepts.\n\n"
            "Given the research context below, generate 4-6 search queries that will "
            "retrieve papers DIRECTLY relevant to this specific research.\n\n"
            "CRITICAL RULES:\n"
            "- Each query should be a precise academic phrase (3-8 words).\n"
            "- Use SPECIFIC academic terminology, not colloquial terms.\n"
            "- AVOID ambiguous words that have different meanings across disciplines. "
            "For example, if the research is about content 'going viral' on social media, "
            "do NOT use the word 'viral' alone — OpenAlex will return biomedical papers "
            "about biological viruses. Instead use phrases like 'social media mobilization' "
            "or 'digital activism policy change.'\n"
            "- Cover DIFFERENT facets of the research: the core phenomenon, the theoretical "
            "frameworks mentioned, the methodology, the geographic/empirical context.\n"
            "- Include queries for the specific theoretical frameworks or key authors "
            "mentioned in the research context.\n\n"
            f"## Research Context\n{research_context}\n\n"
            'Return ONLY a JSON array of strings: ["query one", "query two", ...]'
        )

        try:
            text = self._generate(prompt)
            self.request_count += 1
            queries = json.loads(text)
            if isinstance(queries, list):
                return [str(q) for q in queries if q]
            return []
        except Exception as exc:
            logger.error("Gemini query extraction failed: %s", exc)
            self.request_count += 1
            return []

    def expand_queries(self, user_context: str, previous_queries: list[str]) -> list[str]:
        """Generate new orthogonal search queries based on previous attempts."""
        if self.limit_reached:
            return []

        prompt = (
            "You are an expert research librarian. The following search queries have "
            "already been used to search OpenAlex and are now exhausted:\n"
            f"{json.dumps(previous_queries)}\n\n"
            "Given the original research context below, generate 3-5 NEW and DIFFERENT "
            "search queries that approach the topic from angles NOT covered above.\n\n"
            "RULES:\n"
            "- Use synonyms, related theories, adjacent concepts, or narrower sub-topics.\n"
            "- AVOID ambiguous terms that could match unrelated disciplines.\n"
            "- Each query should be a precise academic phrase (3-8 words).\n"
            "- Think about what a researcher would actually search for to find papers "
            "they would cite in their literature review on this topic.\n\n"
            f"## Research Context\n{user_context}\n\n"
            'Return ONLY a JSON array of strings: ["new query one", "new query two", ...]'
        )

        try:
            text = self._generate(prompt)
            self.request_count += 1
            queries = json.loads(text)
            if isinstance(queries, list):
                return [str(q) for q in queries if q]
            return []
        except Exception as exc:
            logger.error("Gemini query expansion failed: %s", exc)
            self.request_count += 1
            return []
