from __future__ import annotations

import logging

from .gemini_evaluator import GeminiEvaluator
from .models import InputMode, SearchQuery, UserContext

logger = logging.getLogger(__name__)

MAX_EXPANSION_ROUNDS = 5


class QueryManager:
    def __init__(self, user_context: UserContext, evaluator: GeminiEvaluator):
        self.user_context = user_context
        self.evaluator = evaluator
        self.query_queue: list[SearchQuery] = []
        self.used_queries: list[str] = []
        self.expansion_rounds = 0

    def generate_initial_queries(self) -> list[SearchQuery]:
        """Produce the first round of search queries from user input."""
        if self.user_context.input_mode == InputMode.KEYWORDS:
            queries = [
                SearchQuery(keywords=self.user_context.raw_input, source="initial")
            ]
        else:
            extracted = self.evaluator.extract_queries(self.user_context.raw_input)
            if not extracted:
                logger.warning("Gemini returned no queries; falling back to raw input truncation")
                extracted = [self.user_context.raw_input[:120]]
            queries = [SearchQuery(keywords=kw, source="initial") for kw in extracted]

        self.query_queue = queries
        return queries

    def pop_next_query(self) -> SearchQuery | None:
        if not self.query_queue:
            return None
        query = self.query_queue.pop(0)
        self.used_queries.append(query.keywords)
        return query

    def has_queries(self) -> bool:
        return len(self.query_queue) > 0

    def expand_queries(self) -> list[SearchQuery]:
        """Ask Gemini for new orthogonal queries. Returns empty list when exhausted."""
        if self.expansion_rounds >= MAX_EXPANSION_ROUNDS:
            logger.info("Maximum expansion rounds reached (%d)", MAX_EXPANSION_ROUNDS)
            return []

        new_keywords = self.evaluator.expand_queries(
            self.user_context.raw_input, self.used_queries
        )

        fresh = [
            kw for kw in new_keywords
            if kw.lower() not in {q.lower() for q in self.used_queries}
        ]
        if not fresh:
            logger.info("Query expansion returned no novel queries")
            return []

        self.expansion_rounds += 1
        new_queries = [SearchQuery(keywords=kw, source="expanded") for kw in fresh]
        self.query_queue.extend(new_queries)
        return new_queries

    def inject_user_query(self, keywords: str) -> SearchQuery:
        """Allow the user to manually inject a search query."""
        sq = SearchQuery(keywords=keywords, source="user_edited")
        self.query_queue.insert(0, sq)
        return sq
