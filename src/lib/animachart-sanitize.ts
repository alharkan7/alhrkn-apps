const CHART_OPTION_KEYS = new Set([
  'animation',
  'animations',
  'aspectRatio',
  'backgroundColor',
  'borderColor',
  'color',
  'devicePixelRatio',
  'elements',
  'events',
  'indexAxis',
  'interaction',
  'layout',
  'locale',
  'maintainAspectRatio',
  'normalized',
  'parsing',
  'plugins',
  'responsive',
  'resizeDelay',
  'scales',
  'showLine',
  'spanGaps',
  'transitions',
]);

const OBJECT_OPTION_KEYS = new Set([
  'animations',
  'elements',
  'interaction',
  'layout',
  'plugins',
  'scales',
  'transitions',
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeOptionValue = (value: unknown, key?: string): unknown => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' || typeof value === 'boolean') {
    return OBJECT_OPTION_KEYS.has(key || '') ? undefined : value;
  }

  if (Array.isArray(value)) {
    return value
      .map(item => sanitizeOptionValue(item))
      .filter(item => item !== undefined);
  }

  if (!isPlainObject(value)) return undefined;

  return Object.fromEntries(
    Object.entries(value)
      .map(([childKey, childValue]) => [childKey, sanitizeOptionValue(childValue, childKey)])
      .filter(([, childValue]) => childValue !== undefined)
  );
};

/**
 * Keeps the Chart.js option surface intentionally small and removes null,
 * non-finite, and invalid object values before options are merged. Chart.js
 * ignores most unknown nested plugin settings, but nullable core option
 * objects can crash its resolver (for example, layout: null).
 */
export function sanitizeAnimachartCustomOptions(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => CHART_OPTION_KEYS.has(key))
      .map(([key, optionValue]) => [key, sanitizeOptionValue(optionValue, key)])
      .filter(([, optionValue]) => optionValue !== undefined)
  );
}
