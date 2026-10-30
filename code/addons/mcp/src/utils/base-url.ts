/**
 * The URL Storybook is served from: `origin` plus a normalized `basePath` (`/` or `/seg/`),
 * without a trailing slash.
 */
export function toBaseUrl(origin: string, basePath: string): string {
  return `${origin}${basePath.replace(/\/$/, '')}`;
}
