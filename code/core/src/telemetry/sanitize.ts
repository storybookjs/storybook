import os from 'node:os';
import path from 'node:path';

export interface IErrorWithStdErrAndStdOut {
  stderr?: Buffer | string;
  stdout?: Buffer | string;
  [key: string]: unknown;
}

// Removes all user paths
function regexpEscape(str: string): string {
  return str.replace(/[-[/{}()*+?.\\^$|]/g, `\\$&`);
}

export function removeAnsiEscapeCodes(input = ''): string {
  return input.replace(/\u001B\[[0-9;]*m/g, '');
}

/**
 * Removes all user-specific file system paths from the input string, replacing them with "$SNIP".
 * This helps sanitize sensitive user information from output (such as error messages or logs). e.g.
 * `/Users/username/storybook-app/src/pages/index.js` -> `$SNIP/src/pages/index.js`
 */
export function cleanPaths(str: string, separator: string = path.sep): string {
  if (!str) {
    return str;
  }

  // Generate target strings to sanitize using both cwd and home dir
  const separators = Array.from(new Set([separator, `/`, `\\`]));
  const basePaths = [process.cwd(), os.homedir()].filter(Boolean);
  const targets = basePaths.flatMap((basePath) =>
    separators.map((sep) => ({
      separator: sep,
      normalizedPath: basePath.split(/[\\/]/).join(sep),
    }))
  );

  // For each target paths, generalize up its parent directories
  // and sanitize all such occurrences from the string.
  targets.forEach(({ separator: sep, normalizedPath }) => {
    // Split normalized path into its segments and iterate up the hierarchy.
    const stack = normalizedPath.split(sep);
    while (stack.length > 1) {
      const currentPath = stack.join(sep);

      // Replace all case-insensitive occurrences of this path with "$SNIP".
      const currentRegex = new RegExp(regexpEscape(currentPath), `gi`);
      str = str.replace(currentRegex, `$SNIP`);

      // Also handle the Windows case of doubled separators (e.g., "//", "\\"),
      const doubledSeparatorPath = stack.join(sep + sep);
      const doubledSeparatorRegex = new RegExp(regexpEscape(doubledSeparatorPath), `gi`);
      str = str.replace(doubledSeparatorRegex, `$SNIP`);

      stack.pop();
    }
  });

  return str;
}

// Takes an Error and returns a sanitized JSON String
export function sanitizeError(error: Error, pathSeparator: string = path.sep) {
  try {
    error = {
      ...JSON.parse(JSON.stringify(error)),
      message: removeAnsiEscapeCodes(error.message),
      stack: removeAnsiEscapeCodes(error.stack),
      cause: error.cause,
      name: error.name,
    };

    // Removes all user paths
    const errorString = cleanPaths(JSON.stringify(error), pathSeparator);

    return JSON.parse(errorString);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return `Sanitization error: ${message}`;
  }
}
