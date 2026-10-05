import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { removeExperimentalReview } from './remove-experimental-review.ts';

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
  return checkFix(removeExperimentalReview, { ...options, storybookVersion });
};

const migrate = async (source: string) => {
  vol.fromJSON({ [mainConfigPath]: source });
  const failures = await runFix(removeExperimentalReview, {
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

describe('remove-experimental-review', () => {
  it.each(['true', 'false'])('applies to a main config that sets the flag to %s', async (value) => {
    expect(await check(mainWith(`features: { experimentalReview: ${value} },`))).not.toBeNull();
  });

  it('does not apply to a main config without the flag', async () => {
    expect(await check(mainWith('features: { changeDetection: true },'))).toBeNull();
  });

  it.each(['11.0.0-alpha.1', '11.0.0', '11.1.0'])('applies on Storybook %s', async (version) => {
    expect(
      await check(mainWith('features: { experimentalReview: true },'), version)
    ).not.toBeNull();
  });

  it('does not apply on Storybook 10, which still reads the flag', async () => {
    expect(await check(mainWith('features: { experimentalReview: true },'), '10.6.0')).toBeNull();
  });

  it.each(['true', 'false'])(
    'removes the flag set to %s and keeps the other features',
    async (value) => {
      const source = mainWith(
        `features: { changeDetection: true, experimentalReview: ${value}, experimentalTestSyntax: true },`
      );

      expect(await migrate(source)).toMatchInlineSnapshot(`
        "import type { StorybookConfig } from '@storybook/react-vite';

        const config: StorybookConfig = {
          stories: ['../src/**/*.stories.@(ts|tsx)'],
          framework: '@storybook/react-vite',
          features: {
            changeDetection: true,
            experimentalTestSyntax: true
          },
        };
        export default config;"
      `);
    }
  );

  it('removes the features object when the flag was its only entry', async () => {
    expect(await migrate(mainWith('features: { experimentalReview: true },')))
      .toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite';

      const config: StorybookConfig = {
        stories: ['../src/**/*.stories.@(ts|tsx)'],
        framework: '@storybook/react-vite'
      };
      export default config;"
    `);
  });

  it('fails on a features object with a spread, which it cannot edit', async () => {
    await expect(
      migrate(mainWith('features: { ...sharedFeatures, experimentalReview: true },'))
    ).rejects.toThrow(/spread/);
  });
});
