import { posix } from 'node:path';

/**
 * Normalize a path to use forward slashes and remove .. and .
 *
 * @example
 *
 * ```ts
 * normalizePath('path/to/../file'); // => 'path/file'
 * normalizePath('path/to/./file'); // => 'path/to/file'
 * normalizePath('path\\to\\file'); // => 'path/to/file'
 * ```
 *
 * @param p The path to normalize
 * @returns The normalized path
 */
export function normalizePath(p: string) {
  return posix.normalize(p.replace(/\\/g, '/'));
}
