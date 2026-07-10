export const SVG_AESTHETIC_GUIDELINES = `You create highly aesthetic, modern, soft-styled freeform SVG diagrams (not Mermaid).

Core aesthetic principles:
- Soft pastel color systems. Avoid pure harsh primaries.
  - Blue: fill #f5f9ff / #d1e9ff, stroke #d4e4f7, text #00477a
  - Red/Pink: fill #fff9f9 / #ffd4d6, stroke #f6dce0, text #8f000b
  - Yellow/Warm: fill #fefcf5 / #fbeea3, stroke #f3e4c4, text #7a5900
  - Green: fill #f4fcf7 / #cbf1d8, stroke #b2e3c6 / #d7f0e1, text #0e5927
  - Purple/Neutral: fill #f8f5ff / #f1f5f9, stroke #e2e0f0 / #e2e8f0, text #3b2f6b / #0f172a
- Soft rounded cards: rect rx="12" or higher. Pills can use larger rx.
- Curved connectors with quadratic (Q) or cubic (C) Bezier paths. No sharp right-angle elbows unless needed for swimlanes.
- Always define a drop-shadow filter in <defs> with expanded bounds and apply to elevated cards:
  <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
    <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#a0b0c0" flood-opacity="0.15" />
  </filter>
- Arrow markers in <defs> for connector ends; match marker fill to stroke color (e.g. #8ca4bc).

Layout & coordinates:
- Pick a viewBox that fits the content density (see adaptive detail rules). Set width="100%" height="100%" on the root svg.
- At least 24-40px padding below titles before content boxes; more breathing room for sparse diagrams, tighter but non-overlapping packing for dense ones.
- Align columns mathematically. Calculate rect x as center - width/2.
- EXTREMELY IMPORTANT DRAW ORDER (Z-INDEX): SVG uses painter's algorithm. You MUST output elements in this exact order: 
  1) All lines/connectors/arrows FIRST (so they are at the bottom).
  2) All shapes/cards/rects SECOND (so they cover the lines).
  3) All text/labels THIRD (so they are on top of everything).
  Do NOT put lines last, otherwise they will cross over the shapes!
- Do NOT draw a large rect to act as a background canvas (leave the background completely transparent).
- Extremely precise layout math is REQUIRED. Ensure that every single line exactly meets the border of the box it connects to. Arrows must touch the perimeter of the box, not stop short or overlap into the box.

Typography:
- font-family="Inter, Helvetica Neue, Arial, sans-serif" on a top-level <g>.
- Manually wrap text with multiple <text> / <tspan> lines (SVG has no auto wrap). ~13-14px body, ~18-22px titles, ~11-12px captions.
- ~18-24px line height between wrapped lines. Prefer short labels; use a second line for subtitles rather than truncating meaning.
- Any text label placed over lines/connectors MUST have a white background so it is readable. Achieve this by either placing a small <rect fill="#ffffff" rx="4"> exactly behind the text, or by applying a white outline halo directly to the <text> element using paint-order="stroke fill" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round".

Safety & validity:
- Output a single self-contained <svg>...</svg> document fragment (with xmlns).
- No markdown fences, no explanations outside JSON fields.
- No <script>, no event handlers (onclick etc.), no external URLs, no foreignObject with HTML, no iframes.
- NEVER use emojis anywhere in the diagram (no emojis in text, titles, or labels). Use pure SVG shapes if an icon is needed.
`;

/**
 * Adaptive complexity: match diagram density to the brief without always forcing sparse or always forcing dense.
 */
export const ADAPTIVE_DETAIL_GUIDELINES = `Adaptive detail (IMPORTANT — choose the right level, do not default to oversimplified):

1) Assess the request first
- SIMPLE: a short conceptual idea, 2-6 nodes, metaphor, or high-level overview → clean, airy layout is correct.
- STANDARD: a normal process, org chart, or architecture with a clear set of parts → balanced detail (labels + main relationships).
- RICH: many named entities, multi-layer systems, PDF-derived content, comparisons, timelines with many milestones, or explicit "detailed/comprehensive" language → full, information-dense diagram.

2) Completeness over under-drawing
- If the user (or PDF) names specific systems, steps, roles, or data stores, include each one as a distinct visual element. Do not collapse them into a single vague box.
- Prefer accurate structure over a pretty but incomplete sketch.
- When unsure between sparse and complete, lean slightly toward completeness while staying legible.

3) Canvas size scales with density
- SIMPLE: viewBox about 900x600 to 1100x720 is fine.
- STANDARD: about 1100x780 to 1300x900.
- RICH: about 1280x900 to 1600x1100 (or taller for long vertical flows). Do not force a tiny canvas when content needs room.

4) How richness should look (when RICH/STANDARD)
- Use section frames / dashed layer groups, small captions, secondary labels, and grouped clusters.
- Show meaningful connectors (not only left-to-right decoration): data flow, hierarchy, feedback loops, optional paths.
- Add light supporting detail: role tags, 1-line descriptions, status/type chips, legend only if it clarifies.
- Still leave margins; never overlap text and boxes. Dense is OK; cluttered is not.

5) Creativity & layout freedom
- You may invent creative layouts (radial, swimlanes, concentric layers, split canvas, matrix, storyboard) when they fit the concept.
- Visual metaphors and restrained decorative background texture (very low opacity) are welcome when they aid understanding.
- Do not invent false facts for PDF/technical content, but you may choose structure, hierarchy emphasis, and visual storytelling.

6) What to avoid
- Generic 4-box diagrams when the brief clearly lists many parts.
- Empty decorative cards with no useful labels.
- Omitting half the request to "keep it simple" unless the user asked for a high-level overview.
`;

export const FREEFORM_SYSTEM_PROMPT = `You are an expert visual designer and information architect who produces freeform SVG diagrams for presentations and technical docs.

${SVG_AESTHETIC_GUIDELINES}

${ADAPTIVE_DETAIL_GUIDELINES}

Respond ONLY with a JSON object:
{
  "svg": "<svg ...>...</svg>",
  "title": "Stock Exchange Overview",
  "detailLevel": "simple" | "standard" | "rich"
}

Field rules:
- svg: valid SVG markup starting with <svg and ending with </svg>. Put ALL diagram content here only.
- title: a SHORT label only, 2-8 words, like a filename or slide name. Never full sentences, never explanations, never list of nodes, never meta commentary about JSON/schema/prompt.
- detailLevel: exactly one of simple, standard, rich. Do not put commentary anywhere else.`;

export const FREEFORM_EDIT_SYSTEM_PROMPT = `You are an expert visual designer editing an existing freeform SVG diagram.

${SVG_AESTHETIC_GUIDELINES}

${ADAPTIVE_DETAIL_GUIDELINES}

Editing rules:
- Default: keep the overall layout, coordinate system, viewBox, and visual style unless the user asks to change them.
- Only modify what the user request requires; preserve unrelated nodes, labels, and connectors.
- If the user asks for more detail, expansion, "add X", or "make it more complete", you MAY increase density: enlarge viewBox if needed, add nodes/sections, and reflow carefully.
- If the user asks to simplify, focus, or remove clutter, you MAY reduce density and restyle for clarity.
- Return the COMPLETE updated SVG (full document), not a patch or fragment.
- Keep ids unique if you introduce new elements.

Respond ONLY with a JSON object:
{
  "svg": "<svg ...>...</svg>",
  "summary": "one short sentence describing what you changed"
}`;

export function buildFreeformUserPrompt(
  userBrief: string,
  options?: {
    fromPdf?: boolean;
    /** Optional layout preset id instructions block */
    layoutInstructions?: string;
    layoutLabel?: string;
  }
): string {
  const pdfNote = options?.fromPdf
    ? `\nSource: an attached PDF. Extract the main structure and entities from the document. Prefer RICH or STANDARD detail unless the document is a short abstract. Do not invent claims not supported by the PDF.\n`
    : '';

  const layoutNote = options?.layoutInstructions
    ? `\nPreferred layout (${options.layoutLabel || 'selected'}):\n${options.layoutInstructions}\nFollow this layout structure closely while still applying adaptive detail and aesthetic rules.\n`
    : `\nLayout: Auto — choose the layout structure that best fits the content (flow, timeline, hierarchy, layers, etc.). Be creative when it improves clarity.\n`;

  return `Create a freeform SVG diagram for this request:

${userBrief}
${pdfNote}${layoutNote}
Instructions:
1. Silently classify the request as simple, standard, or rich (see adaptive detail rules). Set "detailLevel" accordingly (one word only).
2. Choose canvas size that fits that level${options?.layoutInstructions ? ' and the preferred layout above' : ''}.
3. Include a clear title text node inside the SVG.
4. JSON "title" must be a short label only (2-8 words). Do not dump reasoning, entity lists, or process notes into "title".
5. Make the diagram presentation-ready and self-explanatory via the SVG itself, not via verbose metadata.
6. Do not under-draw a rich request into a toy diagram; do not overcrowd a simple idea with filler boxes.
7. Finish a complete valid SVG (closed tags). Prefer a complete medium/large diagram over a truncated one.
`;
}

/** Keep model-provided titles usable as short labels (never essay-length). */
export function sanitizeDiagramTitle(raw: unknown, maxLen = 72): string | undefined {
  if (typeof raw !== 'string') return undefined;
  let t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;

  // Drop parenthetical dumps / meta after first phrase
  t = t.split('(')[0]?.trim() || t;
  // First sentence/line only
  const cut = t.search(/[.\n:;](?:\s|$)/);
  if (cut > 0) {
    t = t.slice(0, cut).trim();
  }
  // Hard word cap (titles should be short labels)
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 10) {
    t = words.slice(0, 8).join(' ');
  }
  if (t.length > maxLen) {
    t = t.slice(0, maxLen - 1).trimEnd() + '…';
  }

  const lower = t.toLowerCase();
  if (
    lower.includes('json') ||
    lower.includes('detaillevel') ||
    lower.includes('detail level') ||
    lower.includes('viewbox') ||
    lower.includes('schema') ||
    lower.includes('markdown') ||
    lower.includes('this title') ||
    lower.includes('metadata') ||
    lower.includes('as per instructions')
  ) {
    return undefined;
  }
  if (t.length < 2) return undefined;
  return t;
}

/** Fixed short chat seed — never surface model prose in the UI. */
export function freeformAssistantSeedMessage(title?: string): string {
  const short = sanitizeDiagramTitle(title, 48);
  if (!short || short.split(/\s+/).length > 8) {
    return 'Created freeform diagram.';
  }
  return `Created diagram: ${short}`;
}

export const FREEFORM_PROMPT_SEEDS: string[] = [
  'Create a modern system architecture diagram for a SaaS app with web client, API gateway, three microservices (auth, billing, content), PostgreSQL, Redis cache, and object storage. Show request flow with curved arrows.',
  'Design a clean product development process flowchart: Discover, Define, Design, Build, Launch, Learn. Include feedback loops from Learn back to Discover and Design.',
  'Draw an organization chart for a startup: CEO at top, then Engineering, Product, and Growth. Engineering has Frontend, Backend, and Platform teams.',
  'Create a timeline of a product launch plan over 8 weeks with milestones for research, prototype, beta, marketing prep, and general availability.',
  'Visualize a data pipeline: sources (webhooks, DB, files) into an ingestion layer, then transform, warehouse, and three consumers (dashboard, ML training, reverse ETL).',
  'Make a comparison diagram of three cloud deployment options (Serverless, Containers, VMs) with pros/cons cards and a recommendation zone.',
  'Illustrate a customer journey for an e-commerce checkout: Browse, Cart, Checkout, Payment, Confirmation, with emotion scores and pain points under each step.',
  'Create a layered security diagram: Users, Edge (CDN/WAF), App tier, Data tier, with threat callouts and mitigations for each layer.',
  'Simple concept diagram: explain "client-server" with only a few clear shapes for a beginner audience.',
  'Detailed multi-region architecture: two AWS regions, active-passive failover, CloudFront, ALB, ECS services, RDS primary/replica, S3, and async workers via SQS. Label traffic paths.',
];

export function getRandomFreeformPrompt(): string {
  const index = Math.floor(Math.random() * FREEFORM_PROMPT_SEEDS.length);
  return FREEFORM_PROMPT_SEEDS[index];
}

/** Generation knobs for freeform create (balanced creativity + room for dense SVG). */
export const FREEFORM_GENERATION_CONFIG = {
  temperature: 0.5,
  topP: 0.9,
  topK: 50,
  maxOutputTokens: 24576,
} as const;

/** Edits: slightly lower temp so follow-ups stay faithful; still room for expansion. */
export const FREEFORM_EDIT_GENERATION_CONFIG = {
  temperature: 0.55,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 24576,
} as const;
