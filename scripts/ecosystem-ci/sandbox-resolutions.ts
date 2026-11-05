import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from 'yaml';

import { EXISTING_RESOLUTIONS } from './existing-resolutions.js';

type Overrides = Record<string, string>;

/** Every override pnpm applies to the monorepo at `rootDir`, keyed by pnpm selector. */
export async function readRootOverrides(rootDir: string): Promise<Overrides> {
  const packageJson = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf-8'));
  const workspaceManifest = parse(await readFile(join(rootDir, 'pnpm-workspace.yaml'), 'utf-8'));

  // The vite and svelte runners write to pnpm-workspace.yaml, but pnpm also reads overrides from
  // these package.json fields, so a runner that writes there is picked up too.
  return {
    ...packageJson.resolutions,
    ...packageJson.pnpm?.overrides,
    ...workspaceManifest?.overrides,
  };
}

/**
 * The overrides an ecosystem CI runner injected into the monorepo, as `resolutions` for the sandbox.
 * The sandbox is a pnpm project too, so the selectors carry over unchanged. Storybook's own
 * overrides stay out: they are tuned for the monorepo.
 */
export function toSandboxResolutions(rootOverrides: Overrides): Overrides {
  return Object.fromEntries(
    Object.entries(rootOverrides).filter(([selector]) => !EXISTING_RESOLUTIONS.has(selector))
  );
}
