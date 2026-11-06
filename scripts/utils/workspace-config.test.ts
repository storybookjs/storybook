import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import yml from 'yaml';

import { ROOT_DIRECTORY } from './constants.ts';
import { getCodeWorkspaces } from './workspace.ts';

const readRootFile = (fileName: string) => readFileSync(join(ROOT_DIRECTORY, fileName), 'utf8');

describe('workspace config', () => {
  // pnpm reads workspaces from pnpm-workspace.yaml only. The published `storybook link` command
  // runs `yarn link --all --relative <monorepo>/code` from Yarn reproductions, and Yarn discovers
  // the monorepo's packages through package.json `workspaces`, so both lists must stay in sync.
  it('mirrors the pnpm-workspace.yaml packages in the root package.json workspaces', () => {
    const { packages } = yml.parse(readRootFile('pnpm-workspace.yaml'));
    const { workspaces } = JSON.parse(readRootFile('package.json'));

    expect(packages.length).toBeGreaterThan(0);
    expect(workspaces.packages).toEqual(packages);
  });

  // code/core resolves packages by name at runtime (the CLI dispatcher, create-storybook's
  // template copy), and pnpm only makes visible there what @storybook/code depends on.
  it('links every public workspace package from code/package.json', async () => {
    const { dependencies } = JSON.parse(readRootFile('code/package.json'));
    const publicWorkspaces = await getCodeWorkspaces(false);

    expect(publicWorkspaces.length).toBeGreaterThan(40);
    expect(
      publicWorkspaces
        .map(({ name }) => name)
        .filter((name) => !dependencies[name]?.startsWith('workspace:'))
    ).toEqual([]);
  });
});
