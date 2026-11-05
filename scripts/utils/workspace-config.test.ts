import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import yml from 'yaml';

import { ROOT_DIRECTORY } from './constants.ts';

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
});
