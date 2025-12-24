import * as path from 'path';

function removeWindowsDriveLetter(osSpecificPath: string): string {
  return osSpecificPath.replace(/^[a-zA-Z]:/, '');
}

/**
 * Coverts an os specific path to a unix style path. Use this when writing paths to config files.
 * This should not be used to read files on disk because of the removal of Windows drive letters.
 */
export function normalizePath(osSpecificPath: string): string {
  return removeWindowsDriveLetter(osSpecificPath).split('\\').join('/');
}

/**
 * Normalized path fragments and joins them. Use this when writing paths to config files. This
 * should not be used to read files on disk because of the removal of Windows drive letters.
 */
export function joinPathFragments(...fragments: string[]): string {
  return normalizePath(path.join(...fragments));
}
