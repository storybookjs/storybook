/**
 * Utility taken from @tanstack/router-generator
 */

const possiblyNestedRouteGroupPatternRegex = /\([^/]+\)\/?/g;

export function removeGroups(s: string) {
  return s.replace(possiblyNestedRouteGroupPatternRegex, '');
}

export function removeLayoutSegments(routePath = '/'): string {
  return routePath
    .split('/')
    .filter((segment) => !segment.startsWith('_'))
    .join('/');
}

const underscoreStartEndRegex = /(^_|_$)/gi;
const underscoreSlashRegex = /(\/_|_\/)/gi;

export function removeUnderscores(s?: string) {
  return s?.replace(underscoreStartEndRegex, '').replace(underscoreSlashRegex, '/');
}

export function normalizeFileRoutePath(path: string): string {
  const stripped = removeGroups(removeUnderscores(removeLayoutSegments(path)) ?? '');
  return stripped || '/';
}

export function isPathlessLayoutRoute(path: string): boolean {
  const lastSegment = path.split('/').filter(Boolean).pop() ?? '';
  return lastSegment.startsWith('_');
}
