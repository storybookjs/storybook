const DEFAULT_BASE = '/__storybook';

/** Normalises the plugin's `base` option to a leading slash and no trailing slash. */
export function normalizeBase(base: string = DEFAULT_BASE): string {
  const trimmed = base.trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}
