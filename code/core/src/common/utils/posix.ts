import { posix as posixPath, sep } from 'node:path';

/** Replaces the path separator with forward slashes */
export const posix = (localPath: string, separator: string = sep) =>
  localPath.split(separator).filter(Boolean).join(posixPath.sep);
