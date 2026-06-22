"""Reference Agent — Streamlit UI

An intelligent autonomous literature review system that iteratively
searches OpenAlex and uses Gemini to evaluate academic relevance.
"""
from __future__ import annotations

import os

import streamlit as st

from src.gemini_evaluator import GeminiEvaluator
from src.models import (
    AgentState,
    InputMode,
    LogEntry,
    PaperMetadata,
    SearchQuery,
    UserContext,
)
from src.orchestrator import AgentOrchestrator

# ---------------------------------------------------------------------------
# Page config
# ---------------------------------------------------------------------------
st.set_page_config(
    page_title="Reference Agent",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Custom CSS
# ---------------------------------------------------------------------------
st.markdown("""
<style>
    .stApp { max-width: 1200px; margin: 0 auto; }
    div[data-testid="stStatusWidget"] { display: none; }
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Session state initialization
# ---------------------------------------------------------------------------
def _init_session():
    defaults = {
        "orchestrator": None,
        "logs": [],
        "approved_papers": [],
        "state": AgentState.IDLE,
        "run_complete": False,
        "running": False,
        "gemini_key_set": False,
    }
    for key, val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = val


_init_session()


# ---------------------------------------------------------------------------
# Sidebar — Settings
# ---------------------------------------------------------------------------
with st.sidebar:
    st.markdown("## ⚙️ Settings")

    api_key = st.text_input(
        "Gemini API Key",
        type="password",
        value=os.environ.get("GEMINI_API_KEY", ""),
        help="Your Google Gemini API key. Also reads from GEMINI_API_KEY env var.",
    )
    if api_key:
        os.environ["GEMINI_API_KEY"] = api_key
        st.session_state.gemini_key_set = True

    st.divider()

    target_count = st.slider("Target papers", min_value=5, max_value=100, value=20, step=5)
    per_page = st.slider("Results per OpenAlex page", min_value=10, max_value=50, value=25, step=5)
    max_oa_requests = st.slider("Max OpenAlex requests", min_value=10, max_value=200, value=100, step=10)
    max_gemini_requests = st.slider("Max Gemini requests", min_value=5, max_value=100, value=50, step=5)

    st.divider()
    st.markdown(
        "**Reference Agent** v1.0  \n"
        "Powered by [OpenAlex](https://openalex.org) + [Gemini](https://ai.google.dev)"
    )


# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
st.markdown("# 📚 Reference Agent")
st.markdown(
    "Autonomous literature discovery powered by OpenAlex & Gemini. "
    "Enter your research topic and let the agent find relevant papers."
)

# ---------------------------------------------------------------------------
# Input Section
# ---------------------------------------------------------------------------
st.markdown("---")
st.markdown("### Research Input")

input_mode = st.radio(
    "Input type",
    options=["Keywords", "Research Context"],
    horizontal=True,
    help="Short keywords for quick search, or paste a full research background for LLM-extracted queries.",
)

if input_mode == "Keywords":
    user_input = st.text_input(
        "Search keywords",
        placeholder="e.g., transformer attention mechanism NLP",
    )
    mode = InputMode.KEYWORDS
else:
    user_input = st.text_area(
        "Research context",
        height=180,
        placeholder=(
            "Paste your research background, abstract, or detailed description here. "
            "The agent will extract optimal search queries using Gemini."
        ),
    )
    mode = InputMode.RESEARCH_CONTEXT


# ---------------------------------------------------------------------------
# Run controls
# ---------------------------------------------------------------------------
col_run, col_stop = st.columns([1, 1])

with col_run:
    run_clicked = st.button(
        "🚀 Start Search",
        type="primary",
        disabled=st.session_state.running or not user_input,
        use_container_width=True,
    )

with col_stop:
    stop_clicked = st.button(
        "⏹ Stop",
        disabled=not st.session_state.running,
        use_container_width=True,
    )

if stop_clicked and st.session_state.orchestrator:
    st.session_state.orchestrator.request_stop()

# ---------------------------------------------------------------------------
# Log level formatting helpers
# ---------------------------------------------------------------------------
_LOG_ICONS = {"info": "ℹ️", "success": "✅", "warning": "⚠️", "error": "❌"}


def _format_log(entry: LogEntry) -> str:
    icon = _LOG_ICONS.get(entry.level, "")
    return f"{icon} {entry.message}"


# ---------------------------------------------------------------------------
# Autonomous run logic — with real-time streaming via st.status
# ---------------------------------------------------------------------------
if run_clicked and user_input:
    if not api_key and not os.environ.get("GEMINI_API_KEY"):
        st.error("Please provide a Gemini API key in the sidebar.")
        st.stop()

    st.session_state.logs = []
    st.session_state.approved_papers = []
    st.session_state.run_complete = False
    st.session_state.running = True
    st.session_state.state = AgentState.EXTRACTING_QUERIES
    for k in ("export_json_data", "export_json_name", "export_md_data", "export_md_name", "export_count"):
        st.session_state.pop(k, None)

    user_ctx = UserContext(
        raw_input=user_input,
        input_mode=mode,
        target_count=target_count,
    )

    try:
        evaluator = GeminiEvaluator()
    except ValueError as e:
        st.error(str(e))
        st.session_state.running = False
        st.stop()

    status_container = st.status("🔍 Agent is searching for literature...", expanded=True)
    stats_placeholder = status_container.empty()

    def _streaming_log(entry: LogEntry):
        st.session_state.logs.append(entry)
        status_container.write(_format_log(entry))

    orch = AgentOrchestrator(
        user_context=user_ctx,
        evaluator=evaluator,
        on_log=_streaming_log,
    )
    orch.openalex.per_page = per_page
    orch.openalex.max_requests = max_oa_requests
    orch.evaluator.max_requests = max_gemini_requests
    st.session_state.orchestrator = orch

    results = orch.run_autonomous()

    final_label = (
        f"✅ Search complete — {len(results)} papers approved "
        f"({orch.stats.total_fetched} fetched, {orch.stats.total_evaluated} evaluated)"
    )
    status_container.update(label=final_label, state="complete", expanded=False)

    st.session_state.approved_papers = results
    st.session_state.state = orch.state
    st.session_state.running = False
    st.session_state.run_complete = True
    st.rerun()


# ---------------------------------------------------------------------------
# Stats bar (shown after run)
# ---------------------------------------------------------------------------
if st.session_state.orchestrator and st.session_state.run_complete:
    orch = st.session_state.orchestrator
    st.markdown("---")
    st.markdown("### Dashboard")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Approved", f"{len(st.session_state.approved_papers)}/{target_count}")
    c2.metric("Fetched", orch.stats.total_fetched)
    c3.metric("OpenAlex Calls", orch.stats.openalex_requests)
    c4.metric("Gemini Calls", orch.stats.gemini_requests)


# ---------------------------------------------------------------------------
# Agent Log (persisted after run)
# ---------------------------------------------------------------------------
if st.session_state.logs and st.session_state.run_complete:
    st.markdown("---")
    with st.expander("### Agent Log", expanded=False):
        for entry in st.session_state.logs:
            st.text(_format_log(entry))


# ---------------------------------------------------------------------------
# Results — Manual Pruning Table
# ---------------------------------------------------------------------------
if st.session_state.approved_papers:
    st.markdown("---")
    st.markdown("### Approved Papers — Review & Prune")
    st.markdown("Uncheck papers to remove them from the final export.")

    papers = st.session_state.approved_papers
    keep_flags: list[bool] = []

    for i, paper in enumerate(papers):
        with st.container():
            cols = st.columns([0.5, 8, 2])
            with cols[0]:
                keep = st.checkbox(f"Keep paper {i+1}", value=True, key=f"keep_{i}", label_visibility="collapsed")
                keep_flags.append(keep)
            with cols[1]:
                authors_str = ", ".join(paper.authors[:3])
                if len(paper.authors) > 3:
                    authors_str += " et al."

                st.markdown(f"**{i+1}. {paper.title}**")
                meta_parts = []
                if paper.publication_year:
                    meta_parts.append(f"📅 {paper.publication_year}")
                if paper.cited_by_count:
                    meta_parts.append(f"📊 {paper.cited_by_count} citations")
                if paper.source_name:
                    meta_parts.append(f"📖 {paper.source_name}")
                if paper.is_open_access:
                    meta_parts.append("🔓 Open Access")
                st.caption(" · ".join(meta_parts))

                if authors_str:
                    st.caption(f"👤 {authors_str}")

            with cols[2]:
                if paper.doi:
                    st.link_button("DOI ↗", paper.doi, use_container_width=True)
                elif paper.openalex_url:
                    st.link_button("OpenAlex ↗", paper.openalex_url, use_container_width=True)

            if paper.abstract:
                with st.expander("Abstract", expanded=False):
                    st.write(paper.abstract)
            st.divider()

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------
    st.markdown("### Export Results")

    pruned = [p for p, keep in zip(papers, keep_flags) if keep]
    removed_count = len(papers) - len(pruned)
    if removed_count:
        st.info(f"{removed_count} paper(s) unchecked and will be excluded from export.")

    export_clicked = st.button("💾 Export to JSON & Markdown", type="primary", use_container_width=True)

    if export_clicked and st.session_state.orchestrator:
        orch = st.session_state.orchestrator
        orch.approved_papers = pruned
        orch._on_log = None  # detach stale streaming callback
        json_path, md_path = orch.export_results()
        st.session_state["export_json_data"] = json_path.read_text()
        st.session_state["export_json_name"] = json_path.name
        st.session_state["export_md_data"] = md_path.read_text()
        st.session_state["export_md_name"] = md_path.name
        st.session_state["export_count"] = len(pruned)

    if st.session_state.get("export_count"):
        st.success(f"Exported {st.session_state['export_count']} papers!")
        col_j, col_m = st.columns(2)
        with col_j:
            st.download_button(
                "⬇ Download JSON",
                data=st.session_state["export_json_data"],
                file_name=st.session_state["export_json_name"],
                mime="application/json",
                use_container_width=True,
            )
        with col_m:
            st.download_button(
                "⬇ Download Markdown",
                data=st.session_state["export_md_data"],
                file_name=st.session_state["export_md_name"],
                mime="text/markdown",
                use_container_width=True,
            )

elif st.session_state.run_complete:
    st.markdown("---")
    st.warning("No papers were approved during this search. Try different keywords or a broader research context.")
