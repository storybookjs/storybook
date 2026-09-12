import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommonJsGlobalInEsmError } from 'storybook/internal/server-errors';

// Node phrases this as "... is not defined" (at call time) or "... in ES module scope" (at eval).
const COMMONJS_GLOBAL_REFERENCE = /^(__dirname|__filename|require) is not defined/;

// Returns the CommonJS global (`__dirname`, `__filename` or `require`) a ReferenceError is about,
// or `undefined` when the error is something else.
export function getCommonJsGlobalFromError(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.name !== 'ReferenceError') {
    return undefined;
  }
  return COMMONJS_GLOBAL_REFERENCE.exec(error.message)?.[1];
}

// Best-effort extraction of the source file a stack trace points at, as a cwd-relative path.
// Prefers the first frame inside the project (under cwd, not in node_modules and not in `exclude`,
// e.g. the temporary polyfill copy of the main file), so an error thrown in an imported helper
// points at that helper rather than the entry file or a Storybook internal. Returns `undefined`
// when no usable frame is found.
function getErrorSourceFile(error: Error, exclude: string[]): string | undefined {
  const excluded = new Set(exclude.filter(Boolean));
  const cwd = process.cwd();
  let fallback: string | undefined;

  for (const line of error.stack?.split('\n') ?? []) {
    const match = /\(?(file:\/\/[^\s)]+?):\d+:\d+\)?\s*$/.exec(line.trim());
    if (!match) {
      continue;
    }
    let file: string;
    try {
      file = fileURLToPath(match[1]);
    } catch {
      continue;
    }
    if (excluded.has(file)) {
      continue;
    }
    const relativePath = relative(cwd, file);
    if (!relativePath.startsWith('..') && !relativePath.includes(`node_modules${sep}`)) {
      return relativePath;
    }
    fallback ??= relativePath;
  }
  return fallback;
}

// Wraps an error caused by a CommonJS global in an ESM config/preset file (or one of its hooks) into
// a `CommonJsGlobalInEsmError`, or returns `undefined` for any other error so callers keep their
// existing handling. Pass `sourceExclude` to point `location` at the file the error actually came
// from (parsed from the stack), ignoring the listed files (e.g. a temporary copy of the main file).
export function toCommonJsGlobalInEsmError(
  error: unknown,
  { location, hook, sourceExclude }: { location: unknown; hook?: string; sourceExclude?: string[] }
): CommonJsGlobalInEsmError | undefined {
  const global = getCommonJsGlobalFromError(error);
  if (!global) {
    return undefined;
  }
  const entryLocation =
    typeof location === 'string'
      ? isAbsolute(location)
        ? relative(process.cwd(), location)
        : location
      : JSON.stringify(location);

  const sourceFile = sourceExclude && getErrorSourceFile(error as Error, sourceExclude);

  return new CommonJsGlobalInEsmError({
    location: sourceFile || entryLocation,
    global,
    hook,
    error: error as Error,
  });
}
