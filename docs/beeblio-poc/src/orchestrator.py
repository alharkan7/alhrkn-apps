from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from .gemini_evaluator import GeminiEvaluator
from .models import (
    AgentState,
    BatchEvaluation,
    LogEntry,
    PaperMetadata,
    RunStats,
    SearchQuery,
    UserContext,
)
from .openalex_client import OpenAlexClient
from .query_manager import QueryManager

logger = logging.getLogger(__name__)

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"


class AgentOrchestrator:
    def __init__(
        self,
        user_context: UserContext,
        evaluator: GeminiEvaluator,
        on_log: Callable[[LogEntry], None] | None = None,
    ):
        self.user_context = user_context
        self.evaluator = evaluator
        self.openalex = OpenAlexClient()
        self.query_manager = QueryManager(user_context, evaluator)

        self.state = AgentState.IDLE
        self.approved_papers: list[PaperMetadata] = []
        self.seen_ids: set[str] = set()
        self.stats = RunStats()
        self.logs: list[LogEntry] = []
        self._on_log = on_log

        self._current_query: SearchQuery | None = None
        self._current_cursor: str | None = "*"
        self._pending_batch: list[PaperMetadata] = []
        self._pending_evaluation: BatchEvaluation | None = None
        self._pending_queries: list[SearchQuery] = []

        self._paused = False
        self._stop_requested = False

    @property
    def target_met(self) -> bool:
        return len(self.approved_papers) >= self.user_context.target_count

    @property
    def remaining(self) -> int:
        return max(0, self.user_context.target_count - len(self.approved_papers))

    def _log(self, message: str, level: str = "info"):
        entry = LogEntry(message=message, level=level)
        self.logs.append(entry)
        if self._on_log:
            try:
                self._on_log(entry)
            except Exception:
                pass
        logger.info("[%s] %s", level.upper(), message)

    def request_stop(self):
        self._stop_requested = True

    def pause(self):
        self._paused = True

    def resume(self):
        self._paused = False

    # ------------------------------------------------------------------
    # Main autonomous loop
    # ------------------------------------------------------------------

    def run_autonomous(self) -> list[PaperMetadata]:
        """Run the full retrieval-evaluation loop to completion."""
        self._stop_requested = False

        self._log("Starting autonomous literature search...")
        self.state = AgentState.EXTRACTING_QUERIES
        self._log(f"Target: {self.user_context.target_count} relevant papers")

        queries = self.query_manager.generate_initial_queries()
        self._pending_queries = queries
        self.state = AgentState.AWAITING_QUERY_APPROVAL
        self._log(
            f"Generated {len(queries)} initial search queries: "
            + ", ".join(f'"{q.keywords}"' for q in queries)
        )

        return self._continue_from_queries()

    def continue_after_query_approval(self, approved_queries: list[SearchQuery]) -> list[PaperMetadata]:
        """Resume after user reviews/edits queries."""
        self.query_manager.query_queue = list(approved_queries)
        self._pending_queries = list(approved_queries)
        return self._continue_from_queries()

    def retry_evaluation(self, batch: list[PaperMetadata]) -> BatchEvaluation:
        """Re-evaluate a specific batch (human-in-the-loop retry)."""
        self._log("Retrying evaluation on batch...")
        self.state = AgentState.EVALUATING
        evaluation = self.evaluator.evaluate_batch(
            self.user_context.raw_input, batch
        )
        self.stats.gemini_requests += 1
        self._pending_evaluation = evaluation
        self.state = AgentState.AWAITING_EVALUATION_REVIEW
        return evaluation

    def _continue_from_queries(self) -> list[PaperMetadata]:
        """Core loop: iterate through queries, paginate, evaluate, expand."""
        while not self._stop_requested:
            if self.target_met:
                self._log(
                    f"Target reached! {len(self.approved_papers)} relevant papers found.",
                    "success",
                )
                break

            if self._safety_limit_reached():
                self._log("Safety limits reached. Stopping.", "warning")
                break

            query = self.query_manager.pop_next_query()
            if query is None:
                self._log("No more queries in queue. Attempting expansion...")
                self.state = AgentState.EXPANDING_QUERIES
                new_queries = self.query_manager.expand_queries()
                if not new_queries:
                    self._log("Query expansion exhausted. Stopping.", "warning")
                    break
                self._log(
                    f"Expanded with {len(new_queries)} new queries: "
                    + ", ".join(f'"{q.keywords}"' for q in new_queries)
                )
                continue

            self._current_query = query
            self._current_cursor = "*"
            self.stats.queries_used.append(query.keywords)
            self._log(f'Searching OpenAlex for: "{query.keywords}"')

            self._paginate_and_evaluate(query)

        self.state = AgentState.COMPLETED
        self._log(
            f"Done. {len(self.approved_papers)} papers approved out of "
            f"{self.stats.total_evaluated} evaluated ({self.stats.total_fetched} fetched).",
            "success",
        )
        return self.approved_papers

    def _paginate_and_evaluate(self, query: SearchQuery):
        """Fetch pages for a single query until exhausted or target met."""
        cursor = "*"
        page_num = 0

        while cursor and not self.target_met and not self._stop_requested:
            if self._safety_limit_reached():
                break

            page_num += 1
            self.state = AgentState.FETCHING
            self._log(f'  Fetching page {page_num} for "{query.keywords}"...')

            papers, next_cursor = self.openalex.search_works(query.keywords, cursor)
            self.stats.openalex_requests += 1

            if not papers:
                self._log(f"  No more results for this query.", "info")
                break

            new_papers = [p for p in papers if p.openalex_id not in self.seen_ids]
            for p in new_papers:
                self.seen_ids.add(p.openalex_id)
            self.stats.total_fetched += len(new_papers)

            if not new_papers:
                self._log("  All papers in this page already seen. Skipping.", "info")
                cursor = next_cursor
                continue

            self._log(f"  Evaluating {len(new_papers)} new papers with Gemini...")
            self.state = AgentState.EVALUATING
            evaluation = self.evaluator.evaluate_batch(
                self.user_context.raw_input, new_papers
            )
            self.stats.gemini_requests += 1
            self.stats.total_evaluated += len(new_papers)

            approved_in_batch = 0
            for ev in evaluation.evaluations:
                if ev.is_relevant:
                    paper = next(
                        (p for p in new_papers if p.openalex_id == ev.openalex_id),
                        None,
                    )
                    if paper and paper.openalex_id not in {
                        a.openalex_id for a in self.approved_papers
                    }:
                        self.approved_papers.append(paper)
                        approved_in_batch += 1

            self.stats.total_approved = len(self.approved_papers)
            self._log(
                f"  +{approved_in_batch} approved "
                f"({len(self.approved_papers)}/{self.user_context.target_count} total)"
            )

            cursor = next_cursor

    def _safety_limit_reached(self) -> bool:
        if self.openalex.request_count >= self.openalex.max_requests:
            return True
        if self.evaluator.limit_reached:
            return True
        return False

    # ------------------------------------------------------------------
    # Output generation
    # ------------------------------------------------------------------

    def export_results(self) -> tuple[Path, Path]:
        """Write approved papers to JSON and Markdown in the results directory."""
        RESULTS_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        json_path = RESULTS_DIR / f"results_{timestamp}.json"
        md_path = RESULTS_DIR / f"results_{timestamp}.md"

        json_data = {
            "metadata": {
                "query": self.user_context.raw_input,
                "target_count": self.user_context.target_count,
                "total_approved": len(self.approved_papers),
                "total_fetched": self.stats.total_fetched,
                "total_evaluated": self.stats.total_evaluated,
                "queries_used": self.stats.queries_used,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
            "papers": [p.model_dump() for p in self.approved_papers],
        }
        json_path.write_text(json.dumps(json_data, indent=2, ensure_ascii=False))

        md_lines = [
            f"# Literature Search Results",
            f"",
            f"**Query:** {self.user_context.raw_input}",
            f"**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            f"**Papers Found:** {len(self.approved_papers)} / {self.user_context.target_count} target",
            f"",
            f"---",
            f"",
        ]

        for i, paper in enumerate(self.approved_papers, 1):
            authors_str = ", ".join(paper.authors[:3])
            if len(paper.authors) > 3:
                authors_str += " et al."

            md_lines.extend([
                f"## {i}. {paper.title}",
                f"",
                f"- **Authors:** {authors_str or 'N/A'}",
                f"- **Year:** {paper.publication_year or 'N/A'}",
                f"- **Source:** {paper.source_name or 'N/A'}",
                f"- **Citations:** {paper.cited_by_count}",
                f"- **Open Access:** {'Yes' if paper.is_open_access else 'No'}",
                f"- **DOI:** {paper.doi or 'N/A'}",
                f"- **OpenAlex:** {paper.openalex_url or 'N/A'}",
                f"",
            ])

            if paper.abstract:
                md_lines.append(f"> {paper.abstract[:400]}{'...' if len(paper.abstract) > 400 else ''}")
                md_lines.append("")

            md_lines.append("---")
            md_lines.append("")

        md_path.write_text("\n".join(md_lines))

        self._log(f"Results exported to {json_path.name} and {md_path.name}", "success")
        return json_path, md_path
