import { describe, expect, it, vi } from 'vitest';

import { type JsPackageManager, getProjectRoot } from 'storybook/internal/common';
import type { PackageJson } from 'storybook/internal/types';

import { join, relative } from 'pathe';

import { blocker } from './block-storybook-overrides.ts';

const PACKAGE_JSONS: Record<string, PackageJson> = {
  'package.json': {
    overrides: { '@storybook/addon-mcp': { storybook: '~10.5.3', valibot: '^1.4.2' } },
  },
  'app/package.json': { devDependencies: { storybook: '^10.5.3' } },
};

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    versions: { storybook: '11.0.0' },
    JsPackageManager: {
      getPackageJson: (path: string) => PACKAGE_JSONS[relative(actual.getProjectRoot(), path)],
    },
  };
});

const checkOptions = (packageJsonPaths: string[]) => ({
  packageManager: {
    packageJsonPaths: packageJsonPaths.map((path) => join(getProjectRoot(), path)),
  } as JsPackageManager,
  mainConfig: { stories: [] },
  mainConfigPath: '.storybook/main.ts',
  configDir: '.storybook',
  storiesPaths: [],
});

describe('storybookOverrides blocker', () => {
  it('blocks on an ancestor package.json override pinning an older Storybook', async () => {
    const result = await blocker.check(checkOptions(['app/package.json', 'package.json']));

    expect(result && blocker.log(result).message).toMatchInlineSnapshot(`
      "These package.json overrides force Storybook packages to versions that exclude 11.0.0:

      - /package.json: overrides › @storybook/addon-mcp › storybook = ~10.5.3

      Update these entries to 11.0.0 or remove them.
      Then run the upgrade again."
    `);
  });

  it('passes without conflicting overrides', async () => {
    expect(await blocker.check(checkOptions(['app/package.json']))).toBe(false);
  });
});
