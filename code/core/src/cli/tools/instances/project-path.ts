// eslint-disable-next-line no-restricted-imports -- checks path.sep and its tests mock node:path
import * as path from 'node:path';

function canonicalizeProjectPath(value: string): string {
  const resolved = path.resolve(value);
  if (path.sep === '\\') {
    // Windows resolve keeps the input drive-letter case; NTFS identity is case-insensitive.
    return resolved.toLowerCase();
  }
  return resolved;
}

export function projectPathsEqual(a: string, b: string): boolean {
  return canonicalizeProjectPath(a) === canonicalizeProjectPath(b);
}
