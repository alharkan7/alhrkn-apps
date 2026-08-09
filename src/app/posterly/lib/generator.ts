import { generateText } from 'ai';
import path from 'path';
import { getModel } from '@/lib/ai';
import type { PosterStyle } from '../types';

const MAX_INPUT_CHARS = 100_000;
const MAX_TITLE_LENGTH = 180;

const STYLE_GUIDANCE: Record<PosterStyle, string> = {
  minimal: 'Use a bright background, generous whitespace, near-black text, and one restrained accent color.',
  editorial: 'Use warm ivory paper tones, dark ink, elegant serif display typography paired with a readable sans-serif, and thin rules.',
  dark: 'Use a deep charcoal background, light text, strong contrast, and two vivid but disciplined accent colors for emphasis.',
  blueprint: 'Use a cool blue background, a subtle technical grid, monospaced labels, and crisp cyan or white accents.',
};

function cleanText(value: string): string {
  return value
    .replace(/\0/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fileTitle(fileName: string): string {
  return truncate(
    cleanText(fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')) || 'Scientific paper',
    MAX_TITLE_LENGTH,
  );
}

export function deriveSourceTitle(sourceText: string, fileName: string): string {
  const firstUsefulLine = sourceText
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s*/, '').replace(/^PAGE\s+\d+\s*/i, '').trim())
    .find((line) => line.length >= 12 && line.length <= MAX_TITLE_LENGTH);

  return truncate(firstUsefulLine || fileTitle(fileName), MAX_TITLE_LENGTH);
}


function stripCodeFence(value: string): string {
  const fenced = value.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || value).trim();
  const start = candidate.search(/<!doctype html|<html[\s>]/i);
  return start >= 0 ? candidate.slice(start).trim() : candidate;
}

function removeScripts(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

/** Remove editor-only attributes and unsafe executable markup before persistence. */
export function sanitizePosterHtml(value: string): string {
  return removeScripts(value)
    .replace(/\s+(?:contenteditable|data-posterly-editing)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<style\b[^>]*data-posterly-editor[^>]*>[\s\S]*?<\/style>/gi, '');
}

const LAYOUT_FIX = `<style data-posterly-layout-fix="v4">
* {
  box-sizing: border-box;
  min-width: 0;
}
@page {
  size: auto;
  margin: 0;
}
html, body {
  width: 1600px !important;
  min-width: 1600px !important;
  min-height: 960px !important;
  height: auto !important;
  max-width: 1600px !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  overflow-wrap: anywhere !important;
}
body {
  display: block !important;
  align-items: initial !important;
  justify-content: initial !important;
}
.poster, [data-poster-root] {
  width: 1600px !important;
  max-width: 1600px !important;
  min-height: 960px !important;
  height: auto !important;
  overflow: visible !important;
}
.poster-container {
  width: 1600px !important;
  max-width: 1600px !important;
  min-height: 960px !important;
  height: auto !important;
  overflow: visible !important;
  align-content: start !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  grid-template-rows: auto auto auto auto !important;
}
.poster-container > * {
  min-width: 0 !important;
  max-width: 100% !important;
}
.poster-container > header {
  grid-column: 1 / -1 !important;
  grid-row: 1 !important;
}
.poster-container > .header-content {
  grid-column: 1 / -1 !important;
  grid-row: 1 !important;
}
.poster-container > .motivation,
.poster-container > .question,
.poster-container > .method {
  grid-row: 2 !important;
}
.poster-container > .motivation {
  grid-column: 1 !important;
}
.poster-container > .question {
  grid-column: 2 !important;
}
.poster-container > .method {
  grid-column: 3 !important;
  height: auto !important;
  min-height: 0 !important;
}
.poster-container > .results {
  grid-column: 1 / -1 !important;
  grid-row: 3 !important;
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  grid-auto-rows: auto !important;
  align-content: start !important;
  min-width: 0 !important;
  overflow: visible !important;
}
.poster-container > .results > h2,
.poster-container > .results > h3 {
  grid-column: 1 / -1 !important;
}
.poster-container > .results > .results-card:last-child {
  grid-column: 1 / -1 !important;
}
.poster-container > .results:has(> .results-grid) {
  display: flex !important;
  flex-direction: column !important;
  grid-template-columns: none !important;
  grid-template-rows: none !important;
}
.poster-container > .results:has(> .results-grid) > .results-grid {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
  grid-auto-rows: auto !important;
  width: 100% !important;
  min-width: 0 !important;
  gap: 20px !important;
  flex: 0 0 auto !important;
}
.poster-container > .results:has(> .results-grid) > .results-grid > .results-card {
  min-width: 0 !important;
  max-width: 100% !important;
}
.poster-container:has(> .results-title) {
  grid-template-rows: auto auto auto auto auto !important;
}
.poster-container:has(> .results-title) > .results-title {
  grid-column: 1 / -1 !important;
  grid-row: 3 !important;
}
.poster-container:has(> .results-title) > .results {
  grid-row: 4 !important;
}
.poster-container:has(> .results-title) > .limitations {
  grid-row: 5 !important;
}
.poster-container:has(> .results-title) > .conclusion {
  grid-row: 5 !important;
}
.poster-container > .limitations {
  grid-column: 1 !important;
  grid-row: 4 !important;
}
.poster-container > .conclusion {
  grid-column: 2 / -1 !important;
  grid-row: 4 !important;
}
.poster-container .section,
.poster-container .results-card,
.poster-container .table-container {
  min-width: 0 !important;
  max-width: 100% !important;
  overflow: visible !important;
}
.poster-container table {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  table-layout: fixed !important;
  font-size: 9px !important;
  line-height: 1.15 !important;
}
.poster-container th,
.poster-container td {
  max-width: 0 !important;
  padding: 4px !important;
  white-space: normal !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}
pre, code {
  max-width: 100% !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
}
img, svg, video, canvas {
  max-width: 100% !important;
}
</style>`;

/** Keep model HTML inside a static poster canvas without nested clipping or horizontal scroll. */
export function normalizePosterHtml(html: string): string {
  if (html.includes('data-posterly-layout-fix="v4"')) return html;
  return /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `${LAYOUT_FIX}</head>`)
    : `${html}${LAYOUT_FIX}`;
}

function fallbackHtml(sourceText: string, sourceFileName: string, style: PosterStyle): string {
  const title = deriveSourceTitle(sourceText, sourceFileName);
  const paragraphs = sourceText
    .split(/\n\s*\n/)
    .map((part) => cleanText(part.replace(/^PAGE\s+\d+\s*/i, '')))
    .filter((part) => part.length > 40)
    .slice(0, 6);
  const sections = ['Background', 'Research question', 'Approach', 'Findings', 'Limitations', 'Conclusion'];
  const accent = style === 'dark' ? '#66e3c4' : style === 'blueprint' ? '#1d8fff' : style === 'editorial' ? '#b65b35' : '#2563eb';
  const background = style === 'dark' ? '#101827' : style === 'editorial' ? '#f7f1e8' : style === 'blueprint' ? '#eaf4ff' : '#f8fafc';
  const ink = style === 'dark' ? '#eef6ff' : '#172033';
  const cards = sections.map((section, index) => `<section class="card"><div class="kicker">0${index + 1}</div><h2>${section}</h2><p>${escapeHtml(paragraphs[index] || 'The supplied paper does not provide enough text for a concise summary of this section.')}</p></section>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
@page{margin:0}*{box-sizing:border-box}html,body{margin:0;background:${background};color:${ink};font-family:Arial,Helvetica,sans-serif}.poster{position:relative;width:1600px;min-height:960px;height:auto;padding:72px;overflow:visible}.eyebrow{color:${accent};font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-size:16px}.header{display:flex;justify-content:space-between;gap:48px;border-bottom:2px solid ${accent};padding-bottom:34px}.header h1{font-size:58px;line-height:1.02;max-width:1120px;margin:18px 0 0;letter-spacing:-.04em}.meta{max-width:380px;font-size:18px;line-height:1.5;opacity:.72;text-align:right}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:32px}.card{border:1px solid ${style === 'dark' ? '#34465e' : '#cbd5e1'};border-radius:18px;padding:26px;min-height:210px;background:${style === 'dark' ? '#182436' : 'rgba(255,255,255,.62)'}.kicker{color:${accent};font-weight:700;font-size:15px;letter-spacing:.12em}.card h2{font-size:25px;margin:13px 0 12px}.card p{font-size:18px;line-height:1.45;margin:0;opacity:.84}.footer{position:absolute;left:72px;right:72px;bottom:42px;font-size:15px;opacity:.62}
</style></head><body><main class="poster"><header class="header"><div><div class="eyebrow">Scientific paper · Posterly</div><h1>${escapeHtml(title)}</h1></div><div class="meta">Generated from ${escapeHtml(sourceFileName)}<br>Verify all claims against the source paper.</div></header><div class="grid">${cards}</div><div class="footer">Source-faithful visual summary · 60 × 36 in landscape</div></main></body></html>`;
}

export async function generatePosterHtml(sourceText: string, sourceFileName: string, style: PosterStyle): Promise<string> {
  const title = deriveSourceTitle(sourceText, sourceFileName);
  if (!process.env.OPENROUTER_API_KEY) return normalizePosterHtml(fallbackHtml(sourceText, sourceFileName, style));

  const system = `You are an expert scientific communication designer. Turn a supplied scientific paper into one polished, self-contained conference poster. The source is authoritative: never invent authors, numbers, methods, results, citations, or claims. Use concise source-grounded wording and preserve uncertainty. Return only complete HTML, with CSS inside one <style> tag. Do not return Markdown fences, explanations, JSON, JavaScript, external assets, external fonts, or network requests.`;
  const prompt = `Create a professional scientific poster from the paper below.

Selected visual style: ${style}
Style direction: ${STYLE_GUIDANCE[style]}

Implementation requirements:
- Return a complete standalone HTML document.
- Make the poster a single static landscape visual with a base width of 1600px and a minimum height of 960px. Do not set a fixed paper size or fixed aspect ratio in @page; use @page { margin: 0 } if needed.
- The entire poster must fit its width with no horizontal scrolling. Never use overflow:auto, overflow:scroll, overflow-x:auto, or overflow:hidden anywhere. Never use fixed-height sections, absolute-positioned content that can overlap, or grid row spans that create implicit rows. Use min-width: 0, max-width: 100%, overflow-wrap: anywhere, and normal wrapping for long text.
- Use one explicit layout grid with three flexible columns and explicit rows. Put the header across all columns, put motivation/question/method in the first content row, put results across all columns in the next row, and put limitations/conclusion in the final row. Do not leave an unused column in the final row; let the conclusion span the remaining columns. Use the class names poster-container, motivation, question, method, results, limitations, conclusion, and results-card for these regions.
- Put the results heading inside the results container as its first child. Do not create a separate heading grid item that can overlap the results cards; if a separate 'results-title' is used, give it its own explicit row immediately before 'results'.
- If using a nested 'results-grid', make it span the full width of 'results' and use a responsive grid such as repeat(auto-fit, minmax(300px, 1fr)); do not let the nested grid become one half-width child of another grid.
- Keep the content within a practical poster budget: no more than 3 concise bullets per section, no paragraph longer than about 45 words, and no more than 5 result cards. If the paper has large tables, summarize the important values in a compact result card instead of reproducing a wide table. If a table is essential, keep it to at most 5 columns, use table-layout: fixed, small readable type, and wrapped cells that fit the card width.
- The root poster canvas may expand vertically when content genuinely needs more room, but all content must remain visible and flow naturally. Never clip content: do not use overflow:hidden or a fixed height on html, body, or the root poster wrapper; use min-height instead.
- Make it immediately legible: one clear title, a short subtitle, authors/affiliation only when present, and sections for motivation, question, method, results, limitations, and conclusion as supported by the paper.
- Use a strong visual hierarchy, compact cards or columns, one or two restrained accent colors, and enough whitespace for a professional conference poster.
- Prefer CSS shapes, rules, grids, and typographic emphasis over decorative filler. Do not create charts or numeric callouts unless the source provides the data.
- Keep text concise, but include the most important evidence and caveats. Never use placeholder copy.
- Use semantic HTML and accessible contrast. Do not include scripts, inline event handlers, iframes, images, SVG data visualizations, or external URLs.

PAPER FILE: ${sourceFileName}
PAPER TEXT:
${sourceText}`;

  try {
    const result = await generateText({
      model: getModel(process.env.POSTERLY_MODEL || 'gemini-2.5-flash'),
      system,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 12_000,
    });
    const html = removeScripts(stripCodeFence(result.text));
    if (!/<(?:!doctype\s+html|html\b)/i.test(html) || !/<style\b/i.test(html)) {
      console.warn('[posterly] model returned invalid HTML; using fallback');
      return normalizePosterHtml(fallbackHtml(sourceText, sourceFileName, style));
    }
    return normalizePosterHtml(html);
  } catch (error) {
    console.warn('[posterly] HTML generation failed; using fallback:', error);
    return normalizePosterHtml(fallbackHtml(sourceText, sourceFileName, style));
  }
}

export function titleFromPosterHtml(html: string, fallback: string): string {
  const match = html.match(/<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)>/i);
  const title = match?.[1]?.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  return title ? truncate(title, MAX_TITLE_LENGTH) : fallback;
}
