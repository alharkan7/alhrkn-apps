/**
 * Extract and sanitize SVG markup from model output.
 * Strips scripts, event handlers, external URLs, and foreignObject HTML abuse.
 */

const ALLOWED_TAGS = new Set([
  'svg', 'g', 'defs', 'clippath', 'mask', 'pattern', 'marker', 'symbol', 'use',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textpath',
  'title', 'desc',
  'lineargradient', 'radialgradient', 'stop',
  'filter', 'fedropshadow', 'fegaussianblur', 'feoffset', 'feblend',
  'fecolormatrix', 'fecomponenttransfer', 'fecomposite', 'feconvolvematrix',
  'fediffuselighting', 'fedisplacementmap', 'feflood', 'fefunca', 'fefuncb',
  'fefuncg', 'fefuncr', 'feimage', 'femerge', 'femergenode', 'femorphology',
  'fespecularlighting', 'fetile', 'feturbulence',
  'image', // only if href is data: or relative; stripped if external below
]);

const EVENT_ATTR = /^on/i;
const URL_ATTRS = new Set(['href', 'xlink:href', 'src']);

export function extractSvg(raw: string): string | null {
  if (!raw) return null;
  let text = raw.trim();
  // Strip markdown fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:svg|xml|html)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  const match = text.match(/<svg\b[\s\S]*<\/svg>/i);
  return match ? match[0] : null;
}

function isSafeUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v || v === '#') return true;
  if (v.startsWith('#')) return true;
  if (v.startsWith('data:image/')) return true;
  // Allow fragment/local references only for use/href
  if (v.startsWith('url(#')) return true;
  return false;
}

/**
 * Lightweight SVG sanitizer without full DOM (works on server and client).
 */
export function sanitizeSvg(input: string): string {
  const extracted = extractSvg(input);
  if (!extracted) {
    throw new Error('No valid <svg> element found in model output');
  }

  // Remove script/style/foreignObject blocks entirely (self-closing and paired)
  let svg = extracted
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<\/?script\b[^>]*>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<foreignObject\b[^>]*\/>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const SVG_TAG_MAP: Record<string, string> = {
    clippath: 'clipPath', textpath: 'textPath', lineargradient: 'linearGradient',
    radialgradient: 'radialGradient', fedropshadow: 'feDropShadow', fegaussianblur: 'feGaussianBlur',
    feoffset: 'feOffset', feblend: 'feBlend', fecolormatrix: 'feColorMatrix',
    fecomponenttransfer: 'feComponentTransfer', fecomposite: 'feComposite', feconvolvematrix: 'feConvolveMatrix',
    fediffuselighting: 'feDiffuseLighting', fedisplacementmap: 'feDisplacementMap', feflood: 'feFlood',
    fefunca: 'feFuncA', fefuncb: 'feFuncB', fefuncg: 'feFuncG', fefuncr: 'feFuncR',
    feimage: 'feImage', femerge: 'feMerge', femergenode: 'feMergeNode', femorphology: 'feMorphology',
    fespecularlighting: 'feSpecularLighting', fetile: 'feTile', feturbulence: 'feTurbulence',
  };

  // Strip disallowed tags (keep content of unknown wrappers removed entirely for safety)
  svg = svg.replace(/<\/?([a-zA-Z0-9:-]+)(\s[^>]*)?>/g, (full, tagName: string, attrs = '') => {
    const tag = tagName.toLowerCase();
    const isClosing = full.startsWith('</');
    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }
    
    const correctTagName = SVG_TAG_MAP[tag] || tagName;

    if (isClosing) {
      return `</${correctTagName}>`;
    }

    const selfClosing = /\/\s*>$/.test(full);
    const cleanedAttrs = sanitizeAttributes(attrs);
    return selfClosing ? `<${correctTagName}${cleanedAttrs} />` : `<${correctTagName}${cleanedAttrs}>`;
  });

  // Ensure xmlns present on root
  if (!/\sxmlns\s*=/.test(svg)) {
    svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return svg.trim();
}

function sanitizeAttributes(attrString: string): string {
  if (!attrString || !attrString.trim()) return '';

  const result: string[] = [];
  // Match attr="..." | attr='...' | attr=bare | boolean attr
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attrString)) !== null) {
    const name = match[1];
    if (!name || name === '/') continue;
    const lower = name.toLowerCase();
    if (EVENT_ATTR.test(lower)) continue;
    if (lower === 'style') {
      // Allow limited style but block url( and expression
      const val = match[2] ?? match[3] ?? match[4] ?? '';
      if (/url\s*\(|expression\s*\(|javascript:/i.test(val)) continue;
      result.push(`${name}="${escapeAttr(val)}"`);
      continue;
    }
    const rawVal = match[2] ?? match[3] ?? match[4];
    if (rawVal === undefined) {
      // boolean attribute
      result.push(name);
      continue;
    }
    if (URL_ATTRS.has(lower) || lower.endsWith(':href')) {
      if (!isSafeUrl(rawVal)) continue;
    }
    if (/javascript:/i.test(rawVal)) continue;
    result.push(`${name}="${escapeAttr(rawVal)}"`);
  }
  return result.length ? ' ' + result.join(' ') : '';
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function parseJsonLoose(responseText: string): any {
  try {
    return JSON.parse(responseText);
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in response');
    try {
      return JSON.parse(match[0]);
    } catch {
      // dynamic import avoided; caller may use jsonrepair
      throw new Error('Failed to parse JSON');
    }
  }
}
