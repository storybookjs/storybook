import { oxcParse } from './parse.ts';
import type { ImportEdge } from './types.ts';
import { disposeOxcParsePool, getOxcParsePool } from './worker-pool.ts';

export type { ImportEdge } from './types.ts';

/**
 * Parses a file with oxc-parser, using the worker pool when available and falling back to
 * inline {@link oxcParse} otherwise. Plugin parsers (Vue/Svelte/MDX) that use
 * `ctx.parseScriptWithOxc` also route through here, so SFC script blocks get the same
 * off-thread treatment as plain JS/TS files.
 */
export async function parseWithOxc(filePath: string, source: string): Promise<ImportEdge[]> {
  const pool = getOxcParsePool();
  if (!pool) {
    return oxcParse(filePath, source);
  }
  try {
    return await pool.parse(filePath, source);
  } catch {
    // Worker-level failure: fall back to inline so a single bad pool doesn't break the
    // whole build. The pool logs its own debug line; callers get the inline error if the
    // parse is genuinely malformed.
    return oxcParse(filePath, source);
  }
}

export { disposeOxcParsePool };
