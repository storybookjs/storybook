import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { logger } from 'storybook/internal/node-logger';

/** Cached results keyed by resolution root. Absence = not yet checked, null = not available. */
const cachedVersions = new Map<string, Record<string, string> | null>();

/**
 * Loads the `vite-plus/versions` map, resolving it from the target project first.
 *
 * During `npx storybook init` the CLI runs out of the npx cache, so a bare
 * `import('vite-plus/versions')` resolves the specifier against the CLI's own location (where
 * vite-plus isn't installed) rather than the user's project — and silently misses it. We therefore
 * resolve the subpath from `cwd` (the project) explicitly, and only fall back to a bare import (for
 * setups where Storybook and vite-plus share a node_modules, and for the unit tests that mock it).
 */
async function loadVitePlusVersions(cwd: string): Promise<Record<string, string> | null> {
  try {
    const require = createRequire(join(cwd, 'package.json'));
    const resolved = require.resolve('vite-plus/versions');
    const mod = await import(pathToFileURL(resolved).href);
    return mod.versions ?? mod.default?.versions ?? mod.default ?? mod;
  } catch {}

  try {
    // @ts-expect-error - This is a dynamic import of a potentially non-existent package. Vite-plus is currently a peer dependency.
    const mod = await import('vite-plus/versions');
    return mod.versions ?? mod.default?.versions ?? mod.default ?? mod;
  } catch {}

  return null;
}

/**
 * Attempts to load vendored package versions from `vite-plus/versions`.
 *
 * When a project uses vite-plus (typically via `"vite": "npm:vite-plus@..."`), vitest and vite are
 * vendored rather than installed as separate packages. This function retrieves their actual versions
 * from the `vite-plus/versions` subpath export.
 *
 * @param cwd The project directory to resolve `vite-plus` from. Defaults to `process.cwd()`, which
 *   is the target project during `npx storybook init` and `storybook upgrade`.
 * @returns Null when vite-plus is not installed or lacks the `/versions` export (older versions).
 */
export async function getVitePlusVersions(
  cwd: string = process.cwd()
): Promise<Record<string, string> | null> {
  const cached = cachedVersions.get(cwd);
  if (cached !== undefined) {
    return cached;
  }

  const versions = await loadVitePlusVersions(cwd);

  let result: Record<string, string> | null = null;
  if (versions && typeof versions.vite === 'string') {
    logger.debug(`Detected vite-plus: vite=${versions.vite}, vitest=${versions.vitest ?? 'N/A'}`);
    result = versions;
  }

  cachedVersions.set(cwd, result);
  return result;
}

export function clearVitePlusCache(): void {
  cachedVersions.clear();
}
