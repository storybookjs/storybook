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

function isPathlessSegment(segment: string): boolean {
  return segment.startsWith('_') || (segment.startsWith('(') && segment.endsWith(')'));
}

/**
 * A file route whose final segment is pathless (`_layout`, `(group)`) defines
 * a layout/group and contributes nothing to the URL itself; such a route is
 * identified by `id` only. This covers pure-pathless ids (`/_authed`,
 * `/(group)`) as well as pathless layouts nested under pathful segments
 * (`/posts/_layout`). `/` and `''` are the root index, not pathless, and a
 * trailing-underscore (un-nesting) segment like `posts_` stays pathful.
 */
export function isPathlessFileRouteId(id: string): boolean {
  const segments = id.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  return lastSegment != null && isPathlessSegment(lastSegment);
}
