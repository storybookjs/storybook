/**
 * Local re-implementation of TanStack Router path interpolation.
 *
 * The `interpolatePath` export this framework used to call changed shape
 * across the peer range it supports: router-core up to 1.170 (the shape this
 * package was written against) takes `{ path, params }` and returns
 * `{ interpolatedPath }`, while router-core 1.171+ (shipped with
 * `@tanstack/react-router` 1.170.38+) takes `(path, segments, params, ...)`,
 * returns a bare string, and requires pre-parsed segments that only exist on
 * an `init()`ed route, so the new form cannot be called standalone. Calling
 * the object form against the new export throws
 * `path.endsWith is not a function` for every story (TypeError from passing
 * the options object as `path`).
 *
 * To stay correct across the whole `^1.168` peer range, interpolation happens
 * here with semantics matching the old object API:
 *
 * - empty/`/` path → `/`, path without `$` → unchanged
 * - `$key` / `{$key}` → required param, missing value renders as `undefined`
 * - `{-$key}` → optional param, segment dropped when value is absent
 * - `$` / `{$}` → splat, fed by the `_splat` param; dropped when absent
 * - param values are URI-encoded; non-string values are stringified as-is
 * - trailing slashes are preserved; param-free paths are returned unchanged
 */

type PathParams = Record<string, unknown>;

/** Matches tanstack's splat-safe charset; splat values may contain slashes. */
const splatSafePattern = /^[a-zA-Z0-9\-._~!/]*$/;

function encodeParamValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  return encodeURIComponent(value);
}

function encodeSplatValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  if (splatSafePattern.test(value)) {
    return value;
  }
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/**
 * Interpolates one path segment (the text between slashes). Returns the
 * segment's URL text without the leading slash, or `null` when the segment is
 * dropped entirely (absent optional param, absent splat).
 */
function interpolateSegment(part: string, params: PathParams): string | null {
  if (!part.includes('$')) {
    return part;
  }
  if (part === '$') {
    const splat = encodeSplatValue(params._splat);
    return splat ? String(splat) : null;
  }
  if (part.startsWith('$')) {
    const value = encodeParamValue(params[part.slice(1)]);
    return String(value ?? 'undefined');
  }

  const openBrace = part.indexOf('{');
  const closeBrace = openBrace === -1 ? -1 : part.indexOf('}', openBrace);
  if (openBrace === -1 || closeBrace === -1) {
    return part;
  }
  const prefix = part.slice(0, openBrace);
  const suffix = part.slice(closeBrace + 1);
  const inner = part.slice(openBrace + 1, closeBrace);

  if (inner.startsWith('-$')) {
    // Optional param `{-$key}`: dropped entirely when no value is given.
    const key = inner.slice(2);
    const value = params[key];
    if (value == null) {
      return null;
    }
    const encoded = encodeParamValue(value);
    return `${prefix}${String(encoded ?? '')}${suffix}`;
  }
  if (inner === '$') {
    const splat = encodeSplatValue(params._splat);
    if (!splat) {
      return prefix + suffix || null;
    }
    return `${prefix}${String(splat)}${suffix}`;
  }
  if (inner.startsWith('$')) {
    const value = encodeParamValue(params[inner.slice(1)]);
    return `${prefix}${String(value ?? 'undefined')}${suffix}`;
  }

  // Braces that are not param syntax stay literal.
  return part;
}

export function interpolateStoryPath(path: string | undefined, params: PathParams = {}): string {
  if (!path || path === '/') {
    return '/';
  }
  if (!path.includes('$')) {
    return path;
  }
  let joined = '';
  for (const part of path.split('/')) {
    if (!part) {
      // Zero-length segments (leading/double slashes) contribute nothing.
      continue;
    }
    const text = interpolateSegment(part, params);
    if (text !== null) {
      joined += `/${text}`;
    }
  }
  if (path.endsWith('/')) {
    joined += '/';
  }
  return joined || '/';
}
