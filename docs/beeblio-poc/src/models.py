from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, Field


class InputMode(str, Enum):
    KEYWORDS = "keywords"
    RESEARCH_CONTEXT = "research_context"


class UserContext(BaseModel):
    raw_input: str
    input_mode: InputMode
    target_count: int = Field(default=20, ge=1, le=200)


class PaperMetadata(BaseModel):
    openalex_id: str
    doi: str | None = None
    title: str
    abstract: str | None = None
    publication_year: int | None = None
    cited_by_count: int = 0
    concepts: list[str] = Field(default_factory=list)
    primary_topic: str | None = None
    authors: list[str] = Field(default_factory=list)
    institutions: list[str] = Field(default_factory=list)
    source_name: str | None = None
    is_open_access: bool = False
    openalex_relevance_score: float | None = None
    openalex_url: str | None = None


class EvaluationResult(BaseModel):
    openalex_id: str
    title: str
    is_relevant: bool
    rationale: str


class BatchEvaluation(BaseModel):
    evaluations: list[EvaluationResult]


class SearchQuery(BaseModel):
    keywords: str
    source: str = "initial"  # "initial", "expanded", "user_edited"


class AgentState(str, Enum):
    IDLE = "idle"
    EXTRACTING_QUERIES = "extracting_queries"
    AWAITING_QUERY_APPROVAL = "awaiting_query_approval"
    FETCHING = "fetching"
    EVALUATING = "evaluating"
    AWAITING_EVALUATION_REVIEW = "awaiting_evaluation_review"
    EXPANDING_QUERIES = "expanding_queries"
    COMPLETED = "completed"
    ERROR = "error"


class LogEntry(BaseModel):
    message: str
    level: str = "info"  # info, success, warning, error


class RunStats(BaseModel):
    total_fetched: int = 0
    total_evaluated: int = 0
    total_approved: int = 0
    openalex_requests: int = 0
    gemini_requests: int = 0
    queries_used: list[str] = Field(default_factory=list)
