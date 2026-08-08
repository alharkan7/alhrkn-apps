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

export async function extractInputText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as any;
    // PDF.js disables real workers in Node and falls back to importing its
    // worker module. Next's server bundler otherwise resolves that relative
    // import inside `.next/dev/server/chunks`, where the worker does not live.
    pdfjs.GlobalWorkerOptions.workerSrc = path.join(
      process.cwd(),
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    );
    const document = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;

    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => typeof item?.str === 'string' ? item.str : '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) pages.push(`PAGE ${pageNumber}\n${pageText}`);
    }

    const extracted = cleanText(pages.join('\n\n'));
    if (!extracted) throw new Error('This PDF does not contain selectable text. Please provide Markdown or plain text instead.');
    return truncate(extracted, MAX_INPUT_CHARS);
  }

  const isText = mimeType.startsWith('text/') || /\.(md|markdown|txt|html|htm)$/i.test(fileName);
  if (!isText) throw new Error('Supported inputs are PDF, Markdown, plain text, or HTML files.');

  const text = cleanText(buffer.toString('utf8'));
  if (!text) throw new Error('The supplied file is empty.');
  return truncate(text, MAX_INPUT_CHARS);
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
@page{size:60in 36in;margin:0}*{box-sizing:border-box}html,body{margin:0;background:${background};color:${ink};font-family:Arial,Helvetica,sans-serif}.poster{position:relative;width:1600px;height:960px;padding:72px;overflow:hidden}.eyebrow{color:${accent};font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-size:16px}.header{display:flex;justify-content:space-between;gap:48px;border-bottom:2px solid ${accent};padding-bottom:34px}.header h1{font-size:58px;line-height:1.02;max-width:1120px;margin:18px 0 0;letter-spacing:-.04em}.meta{max-width:380px;font-size:18px;line-height:1.5;opacity:.72;text-align:right}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:32px}.card{border:1px solid ${style === 'dark' ? '#34465e' : '#cbd5e1'};border-radius:18px;padding:26px;min-height:210px;background:${style === 'dark' ? '#182436' : 'rgba(255,255,255,.62)'}.kicker{color:${accent};font-weight:700;font-size:15px;letter-spacing:.12em}.card h2{font-size:25px;margin:13px 0 12px}.card p{font-size:18px;line-height:1.45;margin:0;opacity:.84}.footer{position:absolute;left:72px;right:72px;bottom:42px;font-size:15px;opacity:.62}
</style></head><body><main class="poster"><header class="header"><div><div class="eyebrow">Scientific paper · Posterly</div><h1>${escapeHtml(title)}</h1></div><div class="meta">Generated from ${escapeHtml(sourceFileName)}<br>Verify all claims against the source paper.</div></header><div class="grid">${cards}</div><div class="footer">Source-faithful visual summary · 60 × 36 in landscape</div></main></body></html>`;
}

export async function generatePosterHtml(sourceText: string, sourceFileName: string, style: PosterStyle): Promise<string> {
  const title = deriveSourceTitle(sourceText, sourceFileName);
  if (!process.env.OPENROUTER_API_KEY) return fallbackHtml(sourceText, sourceFileName, style);

  const system = `You are an expert scientific communication designer. Turn a supplied scientific paper into one polished, self-contained conference poster. The source is authoritative: never invent authors, numbers, methods, results, citations, or claims. Use concise source-grounded wording and preserve uncertainty. Return only complete HTML, with CSS inside one <style> tag. Do not return Markdown fences, explanations, JSON, JavaScript, external assets, external fonts, or network requests.`;
  const prompt = `Create a professional scientific poster from the paper below.

Selected visual style: ${style}
Style direction: ${STYLE_GUIDANCE[style]}

Implementation requirements:
- Return a complete standalone HTML document.
- Make the poster a fixed landscape canvas of 1600px × 960px, representing a 60 × 36 inch print poster. Include @page { size: 60in 36in; margin: 0 }.
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
      return fallbackHtml(sourceText, sourceFileName, style);
    }
    return html;
  } catch (error) {
    console.warn('[posterly] HTML generation failed; using fallback:', error);
    return fallbackHtml(sourceText, sourceFileName, style);
  }
}

export function titleFromPosterHtml(html: string, fallback: string): string {
  const match = html.match(/<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)>/i);
  const title = match?.[1]?.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  return title ? truncate(title, MAX_TITLE_LENGTH) : fallback;
}
