import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from 'yaml';

import { EXISTING_RESOLUTIONS } from './existing-resolutions.js';

type Overrides = Record<string, string>;

export async function readRootOverrides(rootDir: string): Promise<Overrides> {
  const packageJson = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf-8'));
  const workspaceManifest = parse(await readFile(join(rootDir, 'pnpm-workspace.yaml'), 'utf-8'));

  // pnpm also reads overrides from these package.json fields, in case a runner writes them there.
  return {
    ...packageJson.resolutions,
    ...packageJson.pnpm?.overrides,
    ...workspaceManifest?.overrides,
  };
}

// The sandbox installs with pnpm too, so the pnpm selectors work there unchanged.
export function toSandboxResolutions(rootOverrides: Overrides): Overrides {
  return Object.fromEntries(
    Object.entries(rootOverrides).filter(([selector]) => !EXISTING_RESOLUTIONS.has(selector))
  );
}
