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

export function cleanPaths(str: string, separator: string = path.sep): string {
  if (!str) return str;

  const stack = process.cwd().split(separator);

  while (stack.length > 1) {
    const currentPath = stack.join(separator);
    const currentRegex = new RegExp(regexpEscape(currentPath), `gi`);
    str = str.replace(currentRegex, `$SNIP`);

    const currentPath2 = stack.join(separator + separator);
    const currentRegex2 = new RegExp(regexpEscape(currentPath2), `gi`);
    str = str.replace(currentRegex2, `$SNIP`);

    stack.pop();
  }
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
  } catch (err: any) {
    return `Sanitization error: ${err?.message}`;
  }
}
