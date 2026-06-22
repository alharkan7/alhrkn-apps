# Beeblio: AI-Powered Scientific Paper Search & Review

## 1. Overview
Beeblio is an intelligent literature review app that enhances the traditional academic search experience by layering Large Language Models (LLMs) on top of standard scientific databases. 
Instead of relying solely on exact keyword matches, Beeblio understands research context, optimizes search queries automatically, and acts as an AI reviewer to rank and highlight the most relevant literature.

## 2. Architecture & Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + Framer Motion (for micro-animations) + Radix UI (Shadcn UI)
- **AI Integration**: `@google/generative-ai` (Gemini 2.5 Flash/Pro)
- **Data Sources**: OpenAlex API, Crossref API, Semantic Scholar API

## 3. System Workflow (Architecture Diagram)

```mermaid
sequenceDiagram
    participant U as User
    participant UI as BeeblioClient (Frontend)
    participant S_API as /api/beeblio/search
    participant E_API as /api/beeblio/evaluate
    participant GEMINI as Gemini API
    participant DB as Databases (OpenAlex, S2, Crossref)

    U->>UI: Enter Query (Keywords or Context)
    UI->>S_API: POST { query, databases, aiOptimize }
    opt If aiOptimize == true
        S_API->>GEMINI: Prompt: Optimize Query
        GEMINI-->>S_API: Optimized Boolean Query
    end
    S_API->>DB: Promise.all() Fetch (Parallel)
    DB-->>S_API: Raw JSON Results
    S_API->>S_API: Deduplicate & Clean Data
    S_API-->>UI: Array of 20 Papers

    opt If aiReview == true
        UI->>E_API: POST { papers, originalQuery }
        E_API->>GEMINI: Evaluate 3 Rubrics per Paper
        GEMINI-->>E_API: JSON Array of Scores
        E_API-->>UI: Hydrated Scores
        UI->>UI: Re-sort UI based on AI overallScore
    end
    
    UI-->>U: Render curated results list
    U->>UI: Export to BibTeX
    UI-->>U: beeblio_export.bib Download
```

## 3. Core Features & AI Layers
### 3.1. Input Mechanism
Users can provide search parameters via a tabbed interface:
- **Keywords**: Traditional comma-separated or short phrase input.
- **Research Context**: A text area where users can paste an abstract, a research proposal, or rough ideas.

### 3.2. Layer 1: Query Optimization (Pre-Search)
- **Function**: Translates raw user input (especially lengthy "Research Context") into highly optimized Boolean queries or precise keywords for the target databases.
- **Toggle**: Can be disabled if the user wants strict control over their exact keywords.

### 3.3. Layer 2: Results Review (Post-Search)
- **Function**: Processes the raw JSON output from the databases. The AI reads titles, abstracts, and metadata, comparing them against the user's original intent/context.
- **Output**: 
  - Assigns a Relevance Score.
  - Highlights highly recommended papers with a distinctive visual badge (e.g., ✨ "AI Recommended").
  - Sorts the final aggregated list based on this AI score rather than default database sorting.
- **Toggle**: Can be disabled to see raw, unfiltered results from the databases.

### 3.4. Database Aggregation
- Users can select which databases to search (OpenAlex, Crossref, Semantic Scholar).
- The app fetches results concurrently (`Promise.all`) to ensure speed.

## 4. UI/UX Design Specifications
- **Aesthetics**: Premium, academic yet modern feel. Use glassmorphism for sticky headers/settings panels. Subtle gradient backgrounds for the "AI Recommended" elements.
- **Components**:
  - `HeroSection`: Title and brief description.
  - `SearchInterface`: Contains Tabs (Keywords vs Context), Settings Popover/Accordion, and the main Search input/button.
  - `SettingsPanel`: Toggles for "Optimize Queries" and "AI Review", Checkboxes for Databases.
  - `ResultsFeed`: A list of `PaperCard`s.
  - `PaperCard`: Displays Title, Authors, Year, Citations, Source. Expandable section for the Abstract. Distinctive glowing border or badge for AI-recommended papers.

## 6. Phased Execution Plan
### Phase 1: Foundation & UI Construction
- [x] Register app in `apps.ts`.
- [x] Build the static UI components in `src/app/beeblio/page.tsx` (Search bar, settings, mock paper cards).
- [x] Establish React state for inputs and toggles.

### Phase 2: Database Integrations
- [x] Integrate Database & Storage
- [x] Define `beeblio_` prefixed tables
- [x] Save all queries and settings
- [x] Save papers mapped to search
- [x] Save Gemini evaluations
- [x] File upload to `beeblio` GCS bucket and pass to Geminitegrations
- [x] Create fetching utilities for OpenAlex, Crossref, and Semantic Scholar.
- [x] Integrate parallel fetching logic into Server APIs (`src/app/api/beeblio/search/route.ts`).

### Phase 3: AI Layers (Gemini)
- [x] Implement Layer 1 (Query Optimization) in Search API.
- [x] Implement Layer 2 (Results Review) in Evaluate API (`src/app/api/beeblio/evaluate/route.ts`).
- [x] Add developer fallback logic for API Quota (429) errors.
- [x] Wire the UI to trigger these APIs based on toggle states.

### Phase 4: Polish & Export
- [x] Add Framer Motion animations for cards entering the screen and dynamic layout sorting.
- [x] Fix mobile responsiveness (grid layouts, text wrapping).
- [x] Implement an Export feature (BibTeX format) directly from the client.

### Phase 5: Production Architecture Level-Ups
- [x] Implement Database-Specific Tailored Queries (JSON) in Layer 1.
- [x] Enforce Strict JSON Schema outputs in Layer 2 (Evaluate API).
- [x] Refactor Frontend Evaluation to use Parallel Chunking (batches of 5) to prevent hallucinations.
- [x] Enable Batch Streaming so the UI updates progressively as chunks finish.
- [x] Implement True Next/Prev Pagination with Client-Side Page Caching.

## 7. Operational Cost Estimates (Gemini 2.5 Flash)
Calculated based on standard Gemini 1.5/2.5 Flash pricing:
- **Input Tokens**: ~$0.075 per 1 Million
- **Output Tokens**: ~$0.30 per 1 Million

### Layer 1: AI Query Optimization (Once per search)
- **Standard Keyword Search**:
  - Input: ~120 tokens (System prompt + user query)
  - Output: ~60 tokens (JSON object with 3 tailored queries)
  - Cost: `~$0.000027` per search.
- **Context Mode Search**:
  - Input: ~850 tokens (System prompt + ~3,000 character user context)
  - Output: ~60 tokens
  - Cost: `~$0.000081` per search. (Even with a massive paragraph of context, it's still less than one-hundredth of a cent).

### Layer 2: AI Review & Scoring (Per Page of 15 papers)
The pipeline processes 15 papers in 3 parallel chunks of 5 papers each.
- **Input per chunk**: ~1,500 tokens (5 abstracts + system instructions)
- **Output per chunk**: ~150 tokens (JSON array of 5 scores & rubrics)
- **Cost per chunk**: `~$0.00015`
- **Total Cost per Page (3 chunks)**: `~$0.00047` per page of results.

### Total Pipeline Cost
A full search that fetches 15 results and evaluates all of them costs **`~$0.0005` (half of one-tenth of a cent)**. 
For exactly **$1.00**, you can run **~2,000 complete End-to-End AI Searches**. Because we implemented structured query caching, pagination to subsequent pages only incurs the Layer 2 cost (`~$0.00047`), making deep diving into results even cheaper.