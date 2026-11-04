import { statSync } from 'node:fs';

import { isAbsolute, join } from 'pathe';

const NODE_MODULES_RE = /node_modules/;

// Exclude node_modules stories everywhere we call `glob`
export const commonGlobOptions = (glob: string) =>
  NODE_MODULES_RE.test(glob) ? {} : { ignore: ['**/node_modules/**'] };

/** Whether globs match case-sensitively, following the platform's default file system. */
export const globCaseSensitiveMatch = process.platform !== 'darwin' && process.platform !== 'win32';

const isDirectory = (path: string) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Rewrite each pattern that names an existing directory to match every file inside it.
 *
 * Pass the result to tinyglobby with `expandDirectories: false`, whose own expansion also applies
 * to glob patterns such as `**\/*.mdx`.
 */
export const expandDirectoryPatterns = (patterns: string[], cwd: string) =>
  patterns.map((pattern) => {
    const path = pattern.startsWith('!') ? pattern.slice(1) : pattern;
    return isDirectory(isAbsolute(path) ? path : join(cwd, path)) ? join(pattern, '**') : pattern;
  });
