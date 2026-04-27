import { createRequire } from 'node:module';

import type { ViteDevServer } from 'vite';

const require = createRequire(import.meta.url);

export class BeforeAfterUnsupportedViteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BeforeAfterUnsupportedViteError';
  }
}

/**
 * Reads the installed Vite major version from `vite/package.json`.
 * Returns `null` if Vite is not resolvable from this addon's perspective.
 */
export function readViteMajor(): number | null {
  try {
    const pkg = require('vite/package.json') as { version?: string };
    if (!pkg.version) return null;
    const major = Number.parseInt(pkg.version.split('.')[0]!, 10);
    return Number.isFinite(major) ? major : null;
  } catch {
    return null;
  }
}

/**
 * Throws if the installed Vite version cannot host the Environment API path used by
 * `@storybook/addon-before-after`. Called at `viteFinal` time and again after the
 * dev server resolves so we can fail loud rather than silently producing a broken
 * setup.
 */
export function assertViteEnvironmentApiSupported(server?: ViteDevServer | null): void {
  const major = readViteMajor();
  if (major !== null && major < 6) {
    throw new BeforeAfterUnsupportedViteError(
      `[before-after] STORYBOOK_BEFORE_AFTER_ENV_API=1 requires Vite >= 6 (Environment API). ` +
        `Detected Vite ${major}.x. Either upgrade Vite or unset the flag to use the legacy subprocess path.`
    );
  }
  if (server && server.environments == null) {
    throw new BeforeAfterUnsupportedViteError(
      `[before-after] STORYBOOK_BEFORE_AFTER_ENV_API=1 requires server.environments. ` +
        `The active Vite build does not expose Environment API; unset the flag to use the legacy subprocess path.`
    );
  }
}

export function isEnvApiEnabled(): boolean {
  return process.env.STORYBOOK_BEFORE_AFTER_ENV_API === '1';
}
