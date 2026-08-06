# Primer — Interactive Learning Generator

## Context

The repo (alhrkn-apps) is a Next.js 16 gallery of self-contained AI apps registered in `src/config/apps.ts`. We are adding a new app, Primer (`/primer`), inspired by the interactive-textbook SKILL. Unlike that SKILL (which transforms an uploaded textbook), Primer takes any user topic and generates an academic-style markdown learning page with the SKILL's signature interactivity: nested concept tooltips, expandable "further reading" accordions, gears-level interactive widgets, and LaTeX math.

User-confirmed decisions:
- Name/slug: Primer → `/primer`
- Scope: Full nested-tooltip engine (Paradox-style hover/lock/corridor UX)
- Persistence: Save to DB + history sidebar (matches every other app)
- Provider: OpenRouter + google/gemini-2.5-flash (existing `OPENROUTER_API_KEY`)

## Content contract (what the LLM emits)

A single streamed markdown document. The body is academic prose; the model marks prerequisite concepts inline as `[[Term]]`, embeds widgets as fenced blocks, and ends with a trailing metadata block:

```markdown
# <Title>
<academic markdown body with [[Concept]] inline links>

```widget::slider
{"label":"...","min":0,"max":1,"step":0.1,"default":0.5,"unit":"...","formula":"x*x"}
```

Further detail
<markdown>

```primer:meta
{"title":"...","glossary":[{"term":"Concept","definition":"<markdown, may contain [[links]]>"}]}
```
```

- `[[Term]]` → inline concept link → hover tooltip (definition from glossary).
- ` ```widget::slider|quiz|toggle``` ` → interactive widget (JSON props).
- ` ```primer:expand``` ` → collapsible "further reading" accordion.
- ` ```primer:meta``` ` → stripped from display; parsed into the glossary that powers tooltips.
- `$...$` / `$$...$$` → LaTeX math (KaTeX).

`splitPrimerMeta(text)` (shared in `src/app/primer/lib/parse.ts`) splits body vs. the trailing `primer:meta` block and JSON-parses the glossary (with `jsonrepair` fallback, already used repo-wide). Used by both the server (`onFinish` persist) and the client (progressive strip while streaming).

## DB schema + migration

Add to `src/db/schema.ts` (follow `mindmaps` conventions):

```ts
export const primers = pgTable('primers', {
  id: text('id').primaryKey(),                 // nanoid, generated app-side on create
  userId: uuid('user_id').notNull(),
  topic: text('topic').notNull(),
  title: text('title'),
  content: text('content'),                    // markdown body; null until ready
  glossary: jsonb('glossary').$type<{term:string;definition:string}[]>().default([]),
  options: jsonb('options').$type<{audience?:string;language?:string}>().default({}),
  status: text('status').$type<'pending'|'generating'|'ready'|'error'>().notNull().default('pending'),
  createdAt: timestamp('created_at',{withTimezone:true}).defaultNow(),
  updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow(),
});
export type Primer = typeof primers.$inferSelect;
export type NewPrimer = typeof primers.$inferInsert;
```

Provisioning (repo has no automated migration): add the table to `schema.ts`, add a `scripts/primers_schema.sql` (mirroring `scripts/dnanalyzer_schema.sql`), and run `npx drizzle-kit push` against `DATABASE_URL` (`drizzle-kit` is installed; push syncs schema directly, no migration files). Document the push step in the PR.

## API routes

1. **POST `/api/primer`** (`src/app/api/primer/route.ts`) — auth (`createServerSupabaseClient` + `getUser`, copy animachart route L16-21), INSERT row (`status:'pending'`, `content:null`, title = truncated topic), return `{id, title}`. No streaming; the detail page claims the row before starting generation.
2. **POST `/api/primer/[id]/generate`** (`src/app/api/primer/[id]/generate/route.ts`) — copy the `inztagram/[id]/stream/route.ts` skeleton. Auth + ownership select (`and(eq(id), eq(userId))`) before a status guard:
   - recent `status==='generating'` → 409 (client polls the status endpoint); stale generating rows are reclaimable, ready rows return 409, and pending/error rows are claimed as 'generating', then:
   - `streamText({ model: getModel(process.env.PRIMER_MODEL||'google/gemini-2.5-flash'), system: PRIMER_SYSTEM_PROMPT, prompt: buildPrimerUserPrompt(topic, options), onFinish: async ({ text }) => { splitPrimerMeta + await db.update content/glossary/title/status='ready' } })` → return `result.toTextStreamResponse()`.
   - v7 note: `onFinish` arg is `{ text }`, NOT `{ fullText }`. Await the DB write so a completed stream cannot leave the row stuck in 'generating'.
3. **GET `/api/primer/history`** (`src/app/api/primer/history/route.ts`) — copy `chat/history/route.ts` verbatim, swap `chatSessions→primers`, select `id`, `title`, `createdAt`.
4. **GET `/api/primer/[id]`** — ownership-checked status/content endpoint used while another generation request owns the stream.

## PRIMER_SYSTEM_PROMPT

(`src/app/primer/lib/prompt.ts`): instruct the model to teach an extremely curious first-year undergrad of the relevant major; write faithful, detailed academic markdown; wrap unknown prerequisite concepts in `[[ ]]`; use widgets for gears-level models; use `primer:expand` for deeper asides; math via `$`; emit the trailing `primer:meta` glossary; respond in the user's language (default English).

## Frontend structure (`src/app/primer/`)

- `layout.tsx` — metadata + OG + `<PrimerHistorySidebar/>` + main; toggle event 'togglePrimerHistorySidebar'
- `page.tsx` — 'use client' input: `TopicInputForm` (topic textarea + optional audience/language) → POST `/api/primer` → `router.push('/primer/'+id)`
- `[id]/page.tsx` — server component: `getUser`, `isBotRequest`, redirect login, `db.query.primers.findFirst`, `isOwner`, `<PrimerLessonView primer=.../>`
- `components/`
  - `PrimerHistorySidebar.tsx` — root-only, lazily expanded learning-path explorer backed by `/api/primer/tree`; deep branches use per-node pagination and horizontal overflow
  - `PrimerBreadcrumbs.tsx` — upward-derived parent path with links to each ancestor
  - `PrimerNetworkMap.tsx` — bounded React Flow graph overlay opened from the top bar
  - `TopicInputForm.tsx` — shadcn Input/Textarea/Button/Select + framer-motion (mirror papermap `InputForm` styling)
  - `PrimerLessonView.tsx` — 'use client' heart: streams (or renders saved), owns glossary state, wraps content in `<TooltipProvider>`
  - `markdown/`
    - `MarkdownRenderer.tsx` — `ReactMarkdown` + `remarkGfm` + `remarkConcepts` + `remarkMath` + `rehypeKatex`; `components.a→ConceptLink`, `components.code→dispatch`
    - `PrimerMarkdown.css` — `@tailwindcss/typography` prose + katex css import + tooltip/widget styles
  - `tooltips/`
    - `TooltipProvider.tsx` — context: `glossaryMap`, `chain[]`, `depthCap`; actions `openFrom`/`pruneAfter`/`dismissAll`; also detects selected ranges and renders `<TooltipLayer/>` portal
    - `ConceptLink.tsx` — inline `<a>` for `[[Term]]`: hover/focus open timer, lock progress bar, calls `ctx.openFrom`; circular detection via `chainPath`
    - `ConceptLinkAnchor.tsx` — react-markdown `components.a` bridge: href `#primer-concept-` → `<ConceptLink/>`, else normal `<a>`
    - `TooltipCard.tsx` — one card: renders glossary or generated selection definition, loader/error state, and “Learn more” child-page action
    - `TooltipLayer.tsx` — portal host: positions chain, mousemove/Esc listeners, corridor hit-testing, all timers
  - `widgets/`
    - `WidgetRegistry.tsx` — maps `'slider'|'quiz'|'toggle'` → component; parses JSON props (`jsonrepair`)
    - `SliderWidget.tsx`, `QuizWidget.tsx`, `ToggleWidget.tsx`
  - `ExpandedReading.tsx` — accordion for `primer:expand` blocks (renders inner markdown via `MarkdownRenderer`)
- `lib/`
  - `parse.ts` — `splitPrimerMeta` + helpers (shared client+server)
  - `prompt.ts` — `PRIMER_SYSTEM_PROMPT` + `buildPrimerUserPrompt`
  - `remark-concepts.ts` — remark plugin: `[[Term]]` in text nodes → safe hash link node (prefix `#primer-concept-`); skip code/inlineCode
- `types.ts` — `Primer`, `GlossaryEntry`, `WidgetProps`

## PrimerLessonView streaming flow

(the corrected reader — raw text deltas, NOT the chat SSE hook):
- if `primer.content` present (ready) → render directly with glossary from `primer.glossary`.
- else → `fetch('/api/primer/[id]/generate',{method:'POST'})`; `reader = res.body.getReader()`; loop `acc += decoder.decode(value,{stream:true})`; throttle `setStreamedText` to ~every 100ms (rAF/debounce) to avoid reparsing markdown per token; on 409 → poll `GET /api/primer/[id]` every 1.5s until server returns `status==='ready'`, with a bounded timeout and retry state.
- strip `primer:meta` block from `acc` for display; parse glossary once the block is closed.

## Nested tooltip engine (centerpiece)

Constants (from SKILL spec): `HOVER_OPEN_MS=300`, `LOCK_DELAY_MS=400`, `DISMISS_GRACE_MS=250`, `PRUNE_GRACE_MS=250`, `DEPTH_CAP=5`.

- Provider holds `glossaryMap: Map<term, definition>` (useMemo from glossary), `chain: ChainEntry[]` (`{term, anchorRect, tooltipRect}`), visited set per chain for circular detection. Actions: `openFrom(term, anchorEl, parentIndex)`, `pruneAfter(index)`, `dismissAll(immediate?)`, `reportRect(index, el)`.
- `ConceptLink` (`components.a` intercepts `#primer-concept-` href): 300ms hover/focus timer → `openFrom`; once open, a 400ms "cursor-still" lock timer with a CSS progress bar; lock → card becomes `pointer-events:auto`. On touchend/Enter → open+lock immediately. `aria-haspopup="dialog"`, `aria-expanded`.
- Depth cap: in `openFrom`, if `chain.length >= DEPTH_CAP`, evict the oldest ancestor beyond root (keep root).
- Circular: pass `chainPath` (terms root→here) into each `MarkdownRenderer`; `ConceptLink` with `chainPath.includes(term)` renders as a distinct dashed style and click jumps focus to the existing ancestor card.
- Recursion: `TooltipCard` renders its definition via `MarkdownRenderer` (`depth+1`) → inner `[[links]]` are `ConceptLinks` → `openFrom` appends a child. Bounded by mount-on-open + depth cap + circular set (no infinite render).
- Positioning: adjacent to anchor (prefer right, flip left/below on viewport overflow) via `getBoundingClientRect`; portal is `position:fixed; inset:0; pointer-events:none;`, cards opt back into `pointer-events:auto` only when locked.
- Safe corridor (simplified, effective): the bounding rectangle union of `{anchor ∪ tooltip ∪ straight bridge}`, padded ~16px. `TooltipLayer` mousemove (rAF-throttled): cursor inside any chain entry's corridor → cancel dismissals; outside all → start/continue `DISMISS_GRACE_MS`. Cursor in ancestor `i` only → `PRUNE_GRACE_MS` then prune `i+1`... Esc → `dismissAll(true)`. Portal z-index ≥ 60 (sidebar is `z-[55]`).
- Timers: all dismissal/lock timers live in `TooltipLayer` (one `useRef<Map>`), never per-link, to avoid storms. `ResizeObserver` per card for `reportRect`.

## Learning graph, selection explanations, and navigation

The page hierarchy uses a one-way adjacency list: `primers.parent_id` is nullable and only the child stores its parent. The parent does not store a JSON array of child ids. This is the safer source of truth because breadcrumbs, descendants, and network edges can all be derived from the same relationship without keeping two sides synchronized. Breadcrumb queries walk upward with a recursive CTE; descendant queries fetch only one level at a time.

- `POST /api/primer` accepts `parentId` and validates that the parent belongs to the signed-in user. “Learn more” creates a normal Primer row and navigates to `/primer/<new-id>`; generation remains the existing `/generate` flow.
- `GET /api/primer/tree` returns root rows by default (`parent_id IS NULL`) or direct children for a supplied `parentId`, with `childCount`, `hasChildren`, pagination, and an `ancestorsFor` mode for opening the active path in the explorer sidebar.
- `GET /api/primer/graph?id=<id>` returns a bounded connected neighborhood (maximum 200 nodes) for the React Flow network overlay opened from the top bar.
- `primer_explanations` caches a short explanation by lesson and normalized selection. Selecting a text range opens a locked tooltip after a 220ms intent delay; the card shows a loader while `POST /api/primer/<id>/explain` generates the explanation, then exposes the same “Learn more” action as glossary tooltips.
- The explorer sidebar renders only roots initially, expands descendants lazily, offers per-branch “Load more children,” and uses an inner `min-w-max` surface inside a two-axis scroll container so deep indentation remains usable.

Provision the added `parent_id` column, index, and `primer_explanations` table with `npx drizzle-kit push` or `scripts/primers_schema.sql` before testing these interactions against an existing database.

## Dependencies to add (latest)

- `remark-math`, `rehype-katex`, `katex` (LaTeX; react-markdown-native — the pragmatic choice over MathJax).
- `unist-util-visit`, `@types/mdast` (pin the remark plugin's transitive deps).
- Reuse installed: `react-markdown`, `remark-gfm`, `react-syntax-highlighter`, `@tailwindcss/typography`, `nanoid`, `jsonrepair`, `ai`, `framer-motion`, `lucide` icons.

## Config + env

- `src/config/apps.ts`: add `{ name:'Primer', icon:GraduationCap, slug:'primer', description:'Learn Anything via Interactive Lessons', type:'academic' }` (import `GraduationCap`; `BookOpen` is taken by Beeblio).
- `.env` + `.env.example`: add `PRIMER_MODEL=google/gemini-2.5-flash`.

## Pitfalls (from validation)

1. `onFinish` arg is `{ text }` in AI SDK v7 (not `fullText`).
2. `toTextStreamResponse()` emits raw text deltas — do NOT reuse `useChatMessages.ts` (SSE). New reader appends directly.
3. `onFinish` may perform an async DB write; await persistence so the completed response cannot leave the row stuck in `generating`.
4. Reload-mid-generation → status guard plus stale-row recovery avoids duplicate generation while still recovering crashed requests.
5. remark `[[Term]]` plugin must skip code/inlineCode parents; accept rare straddle misses.
6. `components.a` must short-circuit `#primer-concept-` hrefs before any default rel/target logic.
7. Throttle `setStreamedText` (~100ms) — reparsing markdown + walking text nodes per token is expensive.
8. Tooltip portal z-index ≥ 60 so cards aren't hidden behind the `z-[55]` sidebar.

## Verification

1. `pnpm install` (new deps), then `npx drizzle-kit push` (provision primers table).
2. `pnpm lint` and `pnpm build` (`NODE_OPTIONS` heap already set) pass.
3. `pnpm dev` → open `/`, confirm Primer appears in gallery → `/primer`.
4. Sign in; enter a topic with prerequisites + math (e.g. "Entropy and the Second Law of Thermodynamics") and audience "first-year physics".
5. Confirm: lesson streams in progressively; `[[concepts]]` show as links; hovering one ~300ms opens a tooltip; staying still ~400ms locks it (progress bar) and makes inner links hoverable; nesting works to depth 5 then evicts oldest ancestor; a self-referential term renders dashed; Esc closes all; reload of `/primer/<id>` shows the saved lesson; the History sidebar lists it.
6. Confirm widgets render and are interactive (slider recomputes, quiz grades, toggle reveals) and `primer:expand` accordions open/close.
7. Confirm math (`$E=mc^2$`, block `$$...$$`) renders via KaTeX.
8. Reload mid-generation → no duplicate generation (409 path), lesson finalizes to ready.
9. Check a second browser/user cannot read or generate into another user's lesson (ownership 401/404).
