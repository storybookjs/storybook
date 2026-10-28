import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { removeLegacyFeatureFlags } from './remove-legacy-feature-flags.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const mainConfigPath = '/project/.storybook/main.ts';
const options = {
  packageManager: {} as JsPackageManager,
  configDir: '/project/.storybook',
  mainConfigPath,
  mainConfig: {} as StorybookConfigRaw,
  storiesPaths: [],
};

const check = (source: string, storybookVersion = '11.0.0') => {
  vol.fromJSON({ [mainConfigPath]: source });
  return checkFix(removeLegacyFeatureFlags, { ...options, storybookVersion });
};

const migrate = async (source: string) => {
  vol.fromJSON({ [mainConfigPath]: source });
  const failures = await runFix(removeLegacyFeatureFlags, {
    ...options,
    result: {},
    storybookVersion: '11.0.0',
  });
  if (failures.length > 0) {
    throw new Error(failures.map(({ message }) => message).join('\n'));
  }
  return vol.readFileSync(mainConfigPath, 'utf8') as string;
};

const mainWith = (features: string) => dedent`
  import type { StorybookConfig } from '@storybook/react-vite';

  const config: StorybookConfig = {
    stories: ['../src/**/*.stories.@(ts|tsx)'],
    framework: '@storybook/react-vite',
    ${features}
  };
  export default config;
`;

beforeEach(() => {
  vol.reset();
  vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
  vi.mocked(fsp.readFile).mockImplementation(vol.promises.readFile as typeof fsp.readFile);
  vi.mocked(fsp.writeFile).mockImplementation(vol.promises.writeFile as typeof fsp.writeFile);
});

// Restored so Vitest can write inline snapshots to the real test file.
afterEach(() => {
  vi.mocked(fsp.readFile).mockRestore();
  vi.mocked(fsp.writeFile).mockRestore();
});

describe('remove-legacy-feature-flags', () => {
  it.each([
    ['argTypeTargetsV7', 'true'],
    ['argTypeTargetsV7', 'false'],
    ['disallowImplicitActionsInRenderV8', 'true'],
    ['disallowImplicitActionsInRenderV8', 'false'],
  ])('applies to a main config that sets %s to %s', async (flag, value) => {
    expect(await check(mainWith(`features: { ${flag}: ${value} },`))).not.toBeNull();
  });

  it('does not apply to a main config without the flags', async () => {
    expect(await check(mainWith('features: { experimentalTestSyntax: true },'))).toBeNull();
  });

  it('does not apply when the flags are only commented out next to a spread', async () => {
    const source = mainWith(
      'features: {\n    ...sharedFeatures,\n    // argTypeTargetsV7: false,\n  },'
    );

    expect(await check(source)).toBeNull();
  });

  it.each([
    ["['argTypeTargetsV7']: false", 'argTypeTargetsV7'],
    ['argTypeTargetsV7', 'argTypeTargetsV7'],
    ["['disallowImplicitActionsInRenderV8']: false", 'disallowImplicitActionsInRenderV8'],
    ['disallowImplicitActionsInRenderV8', 'disallowImplicitActionsInRenderV8'],
  ])('applies to a flag written as %s', async (property) => {
    const source = `const argTypeTargetsV7 = false;\n${mainWith(`features: { ${property} },`)}`;

    expect(await check(source)).not.toBeNull();
  });

  it.each(['11.0.0-alpha.1', '11.0.0', '11.1.0'])('applies on Storybook %s', async (version) => {
    expect(await check(mainWith('features: { argTypeTargetsV7: true },'), version)).not.toBeNull();
  });

  it('does not apply on Storybook 10, which still reads the flags', async () => {
    expect(await check(mainWith('features: { argTypeTargetsV7: true },'), '10.6.0')).toBeNull();
  });

  it('removes both flags and keeps the other features', async () => {
    const source = mainWith(
      'features: { controls: true, argTypeTargetsV7: false, disallowImplicitActionsInRenderV8: true, experimentalTestSyntax: true },'
    );

    expect(await migrate(source)).toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite';

      const config: StorybookConfig = {
        stories: ['../src/**/*.stories.@(ts|tsx)'],
        framework: '@storybook/react-vite',
        features: { controls: true, experimentalTestSyntax: true },
      };
      export default config;"
    `);
  });

  it('removes either flag on its own', async () => {
    expect(
      await migrate(
        mainWith('features: { argTypeTargetsV7: true, disallowImplicitActionsInRenderV8: false },')
      )
    ).toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite';

      const config: StorybookConfig = {
        stories: ['../src/**/*.stories.@(ts|tsx)'],
        framework: '@storybook/react-vite',
      };
      export default config;"
    `);
  });

  it('removes the features object when the flags were its only entries', async () => {
    expect(await migrate(mainWith('features: { disallowImplicitActionsInRenderV8: false },')))
      .toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite';

      const config: StorybookConfig = {
        stories: ['../src/**/*.stories.@(ts|tsx)'],
        framework: '@storybook/react-vite',
      };
      export default config;"
    `);
  });

  it('fails on a features object with a spread, which it cannot edit', async () => {
    await expect(
      migrate(mainWith('features: { ...sharedFeatures, argTypeTargetsV7: true },'))
    ).rejects.toThrow(/spread/);
  });
});
