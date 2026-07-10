/** Types and helpers for click-to-select freeform SVG elements. */

export type SvgElementSelection = {
  tagName: string;
  id?: string;
  /** Short human label for UI chips */
  label: string;
  /** Compact structural hint for the model */
  pathHint: string;
  /** Element markup (may be truncated) */
  outerHTML: string;
};

const SKIP_TAGS = new Set([
  'svg',
  'defs',
  'marker',
  'filter',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'mask',
  'pattern',
  'symbol',
  'style',
  'title',
  'desc',
  'metadata',
  'script',
  'fedropshadow',
  'fegaussianblur',
  'feoffset',
  'feblend',
  'fecolormatrix',
  'fecomponenttransfer',
  'fecomposite',
  'feflood',
  'femerge',
  'femergenode',
  'feimage',
  'femorphology',
]);

/** Prefer selecting these leaf-level pieces (text, boxes, lines, etc.). */
const LEAF_TAGS = new Set([
  'rect',
  'circle',
  'ellipse',
  'path',
  'polygon',
  'polyline',
  'text',
  'line',
  'image',
  'use',
]);

function tagOf(el: Element): string {
  return el.tagName.toLowerCase();
}

/** Fraction of root area covered by element (screen space). */
function coverageRatio(el: Element, root: Element): number {
  try {
    const eb = el.getBoundingClientRect();
    const rb = root.getBoundingClientRect();
    const ra = Math.max(rb.width * rb.height, 1);
    return (Math.max(eb.width, 0) * Math.max(eb.height, 0)) / ra;
  } catch {
    return 0;
  }
}

/**
 * True for full-canvas backgrounds / giant wrapper groups that should not be selected.
 */
export function isOversizedSelection(el: Element, root: SVGSVGElement): boolean {
  try {
    const eb = el.getBoundingClientRect();
    const rb = root.getBoundingClientRect();
    if (rb.width < 4 || rb.height < 4) return false;

    const wRatio = eb.width / rb.width;
    const hRatio = eb.height / rb.height;
    const area = coverageRatio(el, root);
    const tag = tagOf(el);

    // Near-full-canvas background rect / layer
    if (wRatio > 0.82 && hRatio > 0.82) return true;
    // Huge groups that wrap most of the diagram (the previous bug)
    if (tag === 'g' && area > 0.4) return true;
    if (tag === 'g' && wRatio > 0.7 && hRatio > 0.55) return true;
    // Any element covering most of the artboard
    if (area > 0.65) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve a DOM node into a selectable SVG element.
 * Prefers individual leaves (text, rect, path, line…) over large groups.
 */
function resolveSelectableFromNode(
  start: Element,
  root: SVGSVGElement
): SVGElement | null {
  let el: Element | null = start;

  while (el && el !== root) {
    if (!(el instanceof SVGElement) || !root.contains(el)) {
      el = el.parentElement;
      continue;
    }

    const tag = tagOf(el);
    if (SKIP_TAGS.has(tag) || tag.startsWith('fe')) {
      el = el.parentElement;
      continue;
    }

    // Collapse tspans into parent text
    if (tag === 'tspan') {
      el = el.parentElement;
      continue;
    }

    // Skip oversized wrappers / backgrounds; try outer candidates via elementsFromPoint stack
    if (isOversizedSelection(el, root)) {
      return null;
    }

    // Prefer concrete drawable elements
    if (LEAF_TAGS.has(tag)) {
      return el;
    }

    // Small local groups only (e.g. icon+label micro-groups), never giant diagram roots
    if (tag === 'g') {
      const childCount = el.childElementCount;
      const area = coverageRatio(el, root);
      // Compact group: few children and modest footprint
      if (childCount >= 1 && childCount <= 12 && area <= 0.35) {
        return el;
      }
      // Large group: don't select it; abandon this hit path
      return null;
    }

    el = el.parentElement;
  }

  return null;
}

/**
 * Pick the best selectable element under a pointer position.
 * Uses the full hit stack so we can skip huge background rects / wrapper groups.
 */
export function findSelectableElementAtPoint(
  clientX: number,
  clientY: number,
  root: SVGSVGElement
): SVGElement | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const node of stack) {
    if (!(node instanceof Element)) continue;
    if (!root.contains(node)) continue;
    const resolved = resolveSelectableFromNode(node, root);
    if (resolved) return resolved;
  }
  return null;
}

/** @deprecated Prefer findSelectableElementAtPoint for accurate leaf hits. */
export function findSelectableElement(
  target: EventTarget | null,
  root: SVGSVGElement
): SVGElement | null {
  if (!(target instanceof Element)) return null;
  return resolveSelectableFromNode(target, root);
}

export function describeElement(el: SVGElement): SvgElementSelection {
  const tagName = tagOf(el);
  const id = el.id || undefined;
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  const labelFromText = text
    ? text.length > 40
      ? text.slice(0, 37) + '…'
      : text
    : undefined;

  // Prefer short labels for pure geometry
  let label = labelFromText;
  if (!label) {
    if (id) label = `#${id}`;
    else if (tagName === 'rect') label = 'Box';
    else if (tagName === 'circle' || tagName === 'ellipse') label = 'Shape';
    else if (tagName === 'path' || tagName === 'line' || tagName === 'polyline') label = 'Line';
    else if (tagName === 'text') label = 'Text';
    else label = tagName;
  }

  const pathParts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && depth < 6) {
    const t = tagOf(cur);
    if (t !== 'svg') {
      pathParts.unshift(cur.id ? `${t}#${cur.id}` : t);
    }
    cur = cur.parentElement;
    depth += 1;
  }

  let outerHTML = el.outerHTML || '';
  const max = 2500;
  if (outerHTML.length > max) {
    outerHTML = outerHTML.slice(0, max) + '\n<!-- truncated -->';
  }

  return {
    tagName,
    id,
    label,
    pathHint: pathParts.join(' > '),
    outerHTML,
  };
}

/** Stable key for multi-select attachment chips. */
export function selectionKey(selection: SvgElementSelection): string {
  if (selection.id) return `id:${selection.id}`;
  // Prefer path + tag so two "Box" rects don't collide too often
  return `${selection.tagName}|${selection.pathHint}|${selection.label}`;
}

export function buildTargetedEditMessage(
  userText: string,
  selection: SvgElementSelection
): string {
  return buildMultiTargetedEditMessage(userText, [selection]);
}

export function buildMultiTargetedEditMessage(
  userText: string,
  selections: SvgElementSelection[]
): string {
  if (!selections.length) return userText.trim();

  const blocks = selections
    .map((selection, i) => {
      return `### Element ${i + 1}: ${selection.label}
- tag: ${selection.tagName}
${selection.id ? `- id: ${selection.id}` : ''}
- path: ${selection.pathHint}
- markup:
\`\`\`svg
${selection.outerHTML}
\`\`\``;
    })
    .join('\n\n');

  return `${userText.trim()}

---
Selected SVG element context (${selections.length} item${selections.length === 1 ? '' : 's'}). Edit these primarily; preserve the rest of the diagram:

${blocks}`;
}

export function buildAttachmentsDisplayMessage(
  userText: string,
  selections: SvgElementSelection[]
): string {
  if (!selections.length) return userText.trim();
  const labels = selections.map((s) => s.label).join(', ');
  return `${userText.trim()}\n\n[Selected: ${labels}]`;
}

export type BoxRect = { left: number; top: number; width: number; height: number };

/** Bounding box of element relative to a container element. */
export function getRelativeBox(el: Element, container: Element, pad = 3): BoxRect | null {
  const er = el.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  if (er.width < 0.5 && er.height < 0.5) return null;
  return {
    left: er.left - cr.left - pad,
    top: er.top - cr.top - pad,
    width: Math.max(er.width + pad * 2, 4),
    height: Math.max(er.height + pad * 2, 4),
  };
}

/**
 * Improve hit-testing for thin strokes and ensure leaves can receive pointer events.
 * Call once after mounting the SVG.
 */
export function prepareSvgForSelection(svg: SVGSVGElement): void {
  svg.style.touchAction = 'none';

  const leaves = svg.querySelectorAll(
    'rect, circle, ellipse, path, polygon, polyline, line, text, tspan, image, use'
  );
  leaves.forEach((node) => {
    const el = node as SVGElement;
    const tag = tagOf(el);
    // Unfilled connectors: hit the stroke; filled shapes: hit fill+stroke
    if (tag === 'line' || tag === 'polyline' || tag === 'path') {
      const fill = (el.getAttribute('fill') || '').toLowerCase();
      el.style.pointerEvents = !fill || fill === 'none' ? 'stroke' : 'all';
    } else {
      el.style.pointerEvents = 'all';
    }
  });

  // Groups pass through to painted children instead of capturing as a solid slab
  svg.querySelectorAll('g').forEach((g) => {
    (g as SVGElement).style.pointerEvents = 'visiblePainted';
  });
}
