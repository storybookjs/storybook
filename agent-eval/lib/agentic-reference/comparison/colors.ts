// Stable, hand-assigned colors for every agentic-ref case, shared by the HTML
// report and the ECDF curves (compare-results embeds them in manifest.json, so
// both renderers read the same values). Explicit per-case entries keep hues
// stable over time: adding an experiment means adding one line here
// (colors.test.ts fails otherwise) and never recolors the existing cases.
// `light` is for white and light grounds (the curves always render on white),
// `dark` for the report's dark theme.

export interface CaseColor {
  light: string;
  dark: string;
}

// Vivid and hue-spread over legibility-for-everyone: distinctness within each
// collection-plan group comes first (those arms share a chart), then across
// the whole registry.
export const CASE_COLORS: Record<string, CaseColor> = {
  'control-none': { light: '#52606D', dark: '#9AA5B1' }, // slate
  empty: { light: '#E8590C', dark: '#FF7E33' }, // orange
  full: { light: '#6741D9', dark: '#9775FA' }, // violet
  'basic-docs': { light: '#1C7ED6', dark: '#4DABF7' }, // blue
  'do-dont': { light: '#B38600', dark: '#FFD43B' }, // gold
  'when-to-use': { light: '#2F9E44', dark: '#51CF66' }, // green
  'history-issues': { light: '#9A5B12', dark: '#CE9247' }, // brown
  a11y: { light: '#0C8599', dark: '#26C6DA' }, // cyan
  'brand-animation': { light: '#AE3EC9', dark: '#DA77F2' }, // fuchsia
  'api-ref': { light: '#66A80F', dark: '#A9E34B' }, // lime
  'docs-full': { light: '#E03131', dark: '#FF6B6B' }, // red
  'stories-api-ref': { light: '#099268', dark: '#20C997' }, // teal
  'stories-showcase': { light: '#4263EB', dark: '#748FFC' }, // indigo
  'stories-highlight': { light: '#C2255C', dark: '#F06595' }, // raspberry
  'stories-examples': { light: '#F76707', dark: '#FFA94D' }, // tangerine
  'stories-full': { light: '#862E9C', dark: '#BE4BDB' }, // grape
  'purge-jsdoc': { light: '#8B5E83', dark: '#BD8CB3' }, // mauve
  'purge-docgen': { light: '#A61E4D', dark: '#F783AC' }, // wine
  // The synthetic --bundle arm; only ever charted against the control.
  bundled: { light: '#5F3DC4', dark: '#B197FC' }, // deep violet
};

/** Cases outside the registry fall back to a neutral gray. */
const FALLBACK: CaseColor = { light: '#6B7280', dark: '#9CA3AF' };

/** The color pair per case, keyed in input order. */
export function caseColors(shortNames: string[]): Record<string, CaseColor> {
  return Object.fromEntries(shortNames.map((name) => [name, CASE_COLORS[name] ?? FALLBACK]));
}
