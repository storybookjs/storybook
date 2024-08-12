import { posix } from 'node:path';

/**
 * Normalize a path to use forward slashes and remove .. and .
 * @param p The path to normalize
 * @returns The normalized path
 * @example
 * normalizePath('path/to/../file') // => 'path/file'
 * normalizePath('path/to/./file') // => 'path/to/file'
 * normalizePath('path\\to\\file') // => 'path/to/file'
 */
export function normalizePath(p: string) {
  return posix.normalize(p.replace(/\\/g, '/'));
}
