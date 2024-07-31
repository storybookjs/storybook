import path from 'node:path';

/**
 * Replaces the path separator with forward slashes
 */
export const posix = (localPath: string, sep: string = path.sep) =>
  localPath.split(sep).filter(Boolean).join(path.posix.sep);
