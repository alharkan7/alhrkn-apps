from __future__ import annotations

import logging
import time

import requests

from .models import PaperMetadata

logger = logging.getLogger(__name__)

OPENALEX_API_BASE = "https://api.openalex.org"
DEFAULT_PER_PAGE = 25
MAX_OPENALEX_REQUESTS = 100
RATE_LIMIT_DELAY = 0.1  # polite crawl delay


class OpenAlexClient:
    def __init__(self, per_page: int = DEFAULT_PER_PAGE, max_requests: int = MAX_OPENALEX_REQUESTS):
        self.per_page = per_page
        self.max_requests = max_requests
        self.request_count = 0
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "ReferenceAgent/1.0 (mailto:reference-agent@example.com)",
        })

    def search_works(self, query: str, cursor: str = "*") -> tuple[list[PaperMetadata], str | None]:
        """Fetch a page of works from OpenAlex for the given query.

        Returns (papers, next_cursor). next_cursor is None when exhausted.
        """
        if self.request_count >= self.max_requests:
            logger.warning("OpenAlex request safety limit reached (%d)", self.max_requests)
            return [], None

        params = {
            "search": query,
            "per_page": self.per_page,
            "cursor": cursor,
            "select": ",".join([
                "id", "doi", "title", "abstract_inverted_index",
                "publication_year", "cited_by_count", "concepts",
                "primary_topic", "authorships", "primary_location",
                "open_access", "relevance_score",
            ]),
        }

        time.sleep(RATE_LIMIT_DELAY)
        try:
            resp = self._session.get(f"{OPENALEX_API_BASE}/works", params=params, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as exc:
            logger.error("OpenAlex request failed: %s", exc)
            return [], None
        finally:
            self.request_count += 1

        data = resp.json()
        results = data.get("results", [])
        next_cursor = data.get("meta", {}).get("next_cursor")

        papers = [self._parse_work(w) for w in results]
        return papers, next_cursor

    @staticmethod
    def _reconstruct_abstract(inverted_index: dict | None) -> str | None:
        if not inverted_index:
            return None
        word_positions: list[tuple[int, str]] = []
        for word, positions in inverted_index.items():
            for pos in positions:
                word_positions.append((pos, word))
        word_positions.sort(key=lambda x: x[0])
        return " ".join(w for _, w in word_positions)

    @classmethod
    def _parse_work(cls, work: dict) -> PaperMetadata:
        concepts = []
        for c in (work.get("concepts") or [])[:8]:
            name = c.get("display_name")
            if name:
                concepts.append(name)

        primary_topic = None
        pt = work.get("primary_topic")
        if pt:
            primary_topic = pt.get("display_name")

        authors: list[str] = []
        institutions: list[str] = []
        for authorship in (work.get("authorships") or [])[:10]:
            author_name = (authorship.get("author") or {}).get("display_name")
            if author_name:
                authors.append(author_name)
            for inst in (authorship.get("institutions") or []):
                inst_name = inst.get("display_name")
                if inst_name and inst_name not in institutions:
                    institutions.append(inst_name)

        source_name = None
        is_oa = False
        primary_loc = work.get("primary_location") or {}
        source = primary_loc.get("source") or {}
        source_name = source.get("display_name")
        oa_info = work.get("open_access") or {}
        is_oa = oa_info.get("is_oa", False)

        return PaperMetadata(
            openalex_id=work.get("id", ""),
            doi=work.get("doi"),
            title=work.get("title") or "Untitled",
            abstract=cls._reconstruct_abstract(work.get("abstract_inverted_index")),
            publication_year=work.get("publication_year"),
            cited_by_count=work.get("cited_by_count", 0),
            concepts=concepts,
            primary_topic=primary_topic,
            authors=authors,
            institutions=institutions[:5],
            source_name=source_name,
            is_open_access=is_oa,
            openalex_relevance_score=work.get("relevance_score"),
            openalex_url=work.get("id"),
        )
