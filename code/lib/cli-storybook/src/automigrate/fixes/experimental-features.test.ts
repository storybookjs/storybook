import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile, writeFile } from 'node:fs/promises';

import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import type { CheckOptions, RunOptions } from '../types.ts';
import {
  enableExperimentalDocgenServer,
  enableExperimentalReview,
} from './experimental-features.ts';

// Spy-only mock: keep the real `node:fs/promises` module shape, then redirect the calls used by
// csf-tools' readConfig/writeConfigFile to `memfs` so disk state stays scoped to `vol`.
vi.mock('node:fs/promises', { spy: true });

const MAIN_CONFIG_PATH = '/project/.storybook/main.ts';

const FIXTURE_MAIN_TS = `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};
export default config;
`;

const checkOptions = (overrides: Partial<CheckOptions> = {}): CheckOptions =>
  ({
    mainConfigPath: MAIN_CONFIG_PATH,
    mainConfig: {} as StorybookConfigRaw,
    storybookVersion: '10.5.0',
    beforeVersion: '10.4.0',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
    ...overrides,
  }) as CheckOptions;

// `run` only reads mainConfigPath and dryRun; the rest of RunOptions is irrelevant here.
const runOptions = (dryRun: boolean): RunOptions<object> =>
  ({ mainConfigPath: MAIN_CONFIG_PATH, dryRun }) as RunOptions<object>;

describe('experimental feature flag automigrations', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof readFile
    );
    vi.mocked(writeFile).mockImplementation(
      memfs.fs.promises.writeFile as unknown as typeof writeFile
    );
  });

  describe('check', () => {
    it.each([
      ['crossing 10.5 within the same major', '10.4.0', '10.5.0', true],
      ['crossing into a 10.5 prerelease', '10.4.0', '10.5.0-rc.1', true],
      ['crossing 10.5 via a later minor', '10.4.0', '10.6.0-alpha.7', true],
      ['already past the boundary', '10.5.0', '10.6.0', false],
      ['not reaching the boundary', '10.3.0', '10.4.0', false],
      ['crossing a major boundary', '9.0.0', '10.5.0', false],
    ])('%s', async (_label, beforeVersion, storybookVersion, expected) => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({ beforeVersion, storybookVersion })
      );
      expect(result !== null).toBe(expected);
    });

    it('is offered regardless of version when no upgrade is in progress', async () => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({ beforeVersion: undefined })
      );
      expect(result).not.toBeNull();
    });

    it.each([true, false])('is not offered when already explicitly set to %s', async (value) => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({
          mainConfig: { features: { experimentalDocgenServer: value } } as StorybookConfigRaw,
        })
      );
      expect(result).toBeNull();
    });

    it('is not offered without a resolvable main config', async () => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({ mainConfigPath: undefined })
      );
      expect(result).toBeNull();
    });

    it('does not offer experimentalReview when changeDetection is explicitly disabled', async () => {
      const result = await enableExperimentalReview.check(
        checkOptions({
          mainConfig: { features: { changeDetection: false } } as StorybookConfigRaw,
        })
      );
      expect(result).toBeNull();
    });
  });

  describe('run', () => {
    it('writes the flag while preserving the rest of the file', async () => {
      vol.fromJSON({ [MAIN_CONFIG_PATH]: FIXTURE_MAIN_TS });

      await enableExperimentalReview.run!(runOptions(false));

      const written = memfs.fs.readFileSync(MAIN_CONFIG_PATH, 'utf-8') as string;
      expect(written).toMatch(/features:\s*{\s*experimentalReview:\s*true/);
      expect(written).toContain(
        `stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],`
      );
      expect(written).toContain(`name: '@storybook/react-vite',`);
      expect(written).toContain('export default config;');
    });

    it('leaves the file untouched on a dry run', async () => {
      vol.fromJSON({ [MAIN_CONFIG_PATH]: FIXTURE_MAIN_TS });

      await enableExperimentalDocgenServer.run!(runOptions(true));

      expect(memfs.fs.readFileSync(MAIN_CONFIG_PATH, 'utf-8')).toBe(FIXTURE_MAIN_TS);
    });
  });
});
