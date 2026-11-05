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
 * The overrides an ecosystem CI runner injected into the monorepo, as `resolutions` for the sandbox,
 * which is a Yarn project. Storybook's own overrides stay out: they are tuned for the monorepo.
 */
export function toSandboxResolutions(rootOverrides: Overrides): Overrides {
  return Object.fromEntries(
    Object.entries(rootOverrides)
      .filter(([selector]) => !EXISTING_RESOLUTIONS.has(selector))
      .map(([selector, value]) => [toYarnSelector(selector), value])
  );
}

// pnpm writes `parent>child` where Yarn writes `parent/child`; `pkg@range` reads the same in both.
// pnpm treats a `>` right after a space, `|` or `@` as part of a range (`pkg@>=1.0.0`), so only the
// first other `>` separates parent from child. Yarn matches a parent only by exact version, so a
// parent range (`parent@^1.0.0>child`) selects nothing in the sandbox.
const PARENT_SEPARATOR = /(?<=[^ |@])>/;

function toYarnSelector(selector: string) {
  return selector.replace(PARENT_SEPARATOR, '/');
}
