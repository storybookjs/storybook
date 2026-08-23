import { isAbsolute, relative } from 'node:path';

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

// Wraps an error caused by a CommonJS global in an ESM config/preset file (or one of its hooks) into
// a `CommonJsGlobalInEsmError`, or returns `undefined` for any other error so callers keep their
// existing handling.
export function toCommonJsGlobalInEsmError(
  error: unknown,
  { location, hook }: { location: unknown; hook?: string }
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

  return new CommonJsGlobalInEsmError({
    location: entryLocation,
    global,
    hook,
    error: error as Error,
  });
}
