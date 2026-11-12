import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import yml from 'yaml';

import { ROOT_DIRECTORY } from './constants.ts';
import { getCodeWorkspaces } from './workspace.ts';

const readRootFile = (fileName: string) => readFileSync(join(ROOT_DIRECTORY, fileName), 'utf8');

describe('workspace config', () => {
  // The published `storybook link` runs `yarn link --all` against this monorepo, and Yarn reads its
  // packages from package.json `workspaces`.
  it('mirrors the pnpm-workspace.yaml packages in the root package.json workspaces', () => {
    const { packages } = yml.parse(readRootFile('pnpm-workspace.yaml'));
    const { workspaces } = JSON.parse(readRootFile('package.json'));

    expect(packages.length).toBeGreaterThan(0);
    expect(workspaces.packages).toEqual(packages);
  });

  // pnpm runs root scripts through its shell emulator (`shellEmulator` in pnpm-workspace.yaml).
  it('runs the root preinstall check through pnpm', () => {
    expect(() =>
      execSync('pnpm run --silent preinstall', { cwd: ROOT_DIRECTORY, stdio: 'pipe' })
    ).not.toThrow();
  });

  // code/core resolves workspace packages by name at runtime, and pnpm only exposes the ones
  // code/package.json depends on.
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
