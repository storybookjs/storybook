import { describe, expect, it, vi } from 'vitest';

import {
  type JsPackageManager,
  type OverrideSource,
  getProjectRoot,
} from 'storybook/internal/common';

import { join } from 'pathe';

import { blocker } from './block-storybook-overrides.ts';

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  versions: { storybook: '11.0.0' },
}));

const checkOptions = (sources: OverrideSource[]) => ({
  packageManager: { getOverrideSources: () => sources } as unknown as JsPackageManager,
  mainConfig: { stories: [] },
  mainConfigPath: '.storybook/main.ts',
  configDir: '.storybook',
  storiesPaths: [],
});

describe('storybookOverrides blocker', () => {
  it('blocks on an override pinning an older Storybook', async () => {
    const result = await blocker.check(
      checkOptions([
        {
          path: join(getProjectRoot(), 'package.json'),
          field: 'overrides',
          overrides: { '@storybook/addon-mcp': { storybook: '~10.5.3', valibot: '^1.4.2' } },
        },
      ])
    );

    expect(result && blocker.log(result).message).toMatchInlineSnapshot(`
      "These overrides force Storybook packages to versions that exclude 11.0.0:

      - /package.json: overrides › @storybook/addon-mcp › storybook = ~10.5.3

      Update these entries to 11.0.0 or remove them."
    `);
  });

  it('passes without conflicting overrides', async () => {
    expect(await blocker.check(checkOptions([]))).toBe(false);
  });
});
