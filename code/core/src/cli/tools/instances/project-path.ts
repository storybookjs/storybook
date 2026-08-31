import * as nodePath from 'node:path';

export type ProjectPathImpl = Pick<typeof nodePath, 'resolve' | 'sep'>;

function canonicalizeProjectPath(value: string, pathImpl: ProjectPathImpl = nodePath): string {
  const resolved = pathImpl.resolve(value);
  if (pathImpl.sep === '\\') {
    // Windows resolve keeps the input drive-letter case; NTFS identity is case-insensitive.
    return resolved.toLowerCase();
  }
  return resolved;
}

export function projectPathsEqual(
  a: string,
  b: string,
  pathImpl: ProjectPathImpl = nodePath
): boolean {
  return canonicalizeProjectPath(a, pathImpl) === canonicalizeProjectPath(b, pathImpl);
}
