import { posix as posixPath, sep } from 'node:path';

/** Replaces the path separator with forward slashes */
export const posix = (localPath: string, seperator: string = sep): string =>
  localPath.split(seperator).filter(Boolean).join(posixPath.sep);
