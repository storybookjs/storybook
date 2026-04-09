import { logger } from 'storybook/internal/node-logger';

/** Cached result: undefined = not yet checked, null = not available */
let cachedVersions: Record<string, string> | null | undefined;

/**
 * Attempts to load vendored package versions from `vite-plus/versions`.
 *
 * When a project uses vite-plus (typically via `"vite": "npm:vite-plus@..."`), vitest and vite are
 * vendored rather than installed as separate packages. This function retrieves their actual versions
 * from the `vite-plus/versions` subpath export.
 *
 * Returns null when vite-plus is not installed or lacks the `/versions` export (older versions).
 */
export async function getVitePlusVersions(): Promise<Record<string, string> | null> {
  if (cachedVersions !== undefined) {
    return cachedVersions;
  }

  try {
    const mod = await import('vite-plus/versions');
    const versions = mod.versions ?? mod;

    if (versions && typeof versions.vite === 'string') {
      logger.debug(`Detected vite-plus: vite=${versions.vite}, vitest=${versions.vitest ?? 'N/A'}`);
      cachedVersions = versions;
      return versions;
    }
  } catch {}

  cachedVersions = null;
  return null;
}

export function clearVitePlusCache(): void {
  cachedVersions = undefined;
}
