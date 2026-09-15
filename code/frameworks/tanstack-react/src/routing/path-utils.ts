import { interpolatePath } from '@tanstack/react-router';

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

type PathInterpolationSegment = string | readonly [1 | 2, string, string, string | undefined];

// `@tanstack/router-core` <1.171.30 exposed `interpolatePath({ path, params })`
// returning `{ interpolatedPath }`; 1.171.30 replaced it with
// `interpolatePath(path, segments, params)` returning the string directly,
// where `segments` are the precompiled route segments a processed route
// carries on `_interpolation`. We don't have a processed route at this point,
// so build the segments the new signature needs ourselves and pick a call
// shape by arity, which differs between the two (1 vs 5).
export function interpolateStoryPath(path: string, params: Record<string, unknown>): string {
  if (interpolatePath.length >= 2) {
    const positionalInterpolatePath = interpolatePath as unknown as (
      path: string,
      segments: PathInterpolationSegment[],
      params: Record<string, unknown>
    ) => string;
    return positionalInterpolatePath(path, toPathInterpolationSegments(path), params);
  }
  const legacyInterpolatePath = interpolatePath as unknown as (options: {
    path: string;
    params: Record<string, unknown>;
  }) => { interpolatedPath: string };
  return legacyInterpolatePath({ path, params }).interpolatedPath;
}

function toPathInterpolationSegments(path: string): PathInterpolationSegment[] {
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      if (part === '$') {
        return [2, '_splat', '/', undefined] as const;
      }
      if (part.startsWith('$')) {
        return [1, part.slice(1), '/', ''] as const;
      }
      return `/${part}`;
    });
}
