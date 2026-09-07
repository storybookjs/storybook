import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile, writeFile } from 'node:fs/promises';

import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import type { CheckOptions, RunOptions } from '../types.ts';
import {
  createExperimentalFeatureFix,
  enableExperimentalDocgenServer,
  enableExperimentalReview,
  resolveRequestedFeatures,
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

const REACT_MAIN_CONFIG = { framework: { name: '@storybook/react-vite' } } as StorybookConfigRaw;

const checkOptions = (overrides: Partial<CheckOptions> = {}): CheckOptions =>
  ({
    mainConfigPath: MAIN_CONFIG_PATH,
    mainConfig: REACT_MAIN_CONFIG,
    storybookVersion: '10.5.0',
    beforeVersion: '10.4.0',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
    ...overrides,
  }) as CheckOptions;

const withFeatures = (features: StorybookConfigRaw['features']): StorybookConfigRaw =>
  ({ ...REACT_MAIN_CONFIG, features }) as StorybookConfigRaw;

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
    // Each flag carries its own `introducedIn`, so a flag added in a later minor must stay hidden
    // on an upgrade that does not reach it. Both shipped flags are 10.5, so this needs its own fix.
    describe('per-feature introducedIn', () => {
      const futureFlag = createExperimentalFeatureFix({
        id: 'enable-future-flag',
        name: 'experimentalDocgenServer',
        introducedIn: '10.7.0',
        link: 'https://example.com',
        prompt: 'Enable a flag introduced in 10.7.',
      });

      it('is not offered on an upgrade that stops short of its own version', async () => {
        const result = await futureFlag.check(
          checkOptions({ beforeVersion: '10.4.0', storybookVersion: '10.5.0' })
        );
        expect(result).toBeNull();
      });

      it('is offered on the upgrade that crosses its own version', async () => {
        const result = await futureFlag.check(
          checkOptions({ beforeVersion: '10.6.0', storybookVersion: '10.7.0' })
        );
        expect(result).not.toBeNull();
      });

      it('is not written into a project older than its own version, even when requested', async () => {
        const result = await futureFlag.check(
          checkOptions({ beforeVersion: undefined, storybookVersion: '10.6.0', requested: true })
        );
        expect(result).toBeNull();
      });
    });

    it.each([
      ['crossing 10.5 within the same major', '10.4.0', '10.5.0', true],
      ['crossing into a 10.5 prerelease', '10.4.0', '10.5.0-rc.1', true],
      ['crossing 10.5 via a later minor', '10.4.0', '10.6.0-alpha.7', true],
      ['crossing a major boundary', '9.0.0', '10.5.0', true],
      ['already past the boundary', '10.5.0', '10.6.0', false],
      ['not reaching the boundary', '10.3.0', '10.4.0', false],
    ])('%s', async (_label, beforeVersion, storybookVersion, expected) => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({ beforeVersion, storybookVersion })
      );
      expect(result !== null).toBe(expected);
    });

    it('is not offered outside an upgrade unless the fix was requested by name', async () => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({ beforeVersion: undefined })
      );
      expect(result).toBeNull();
    });

    it('is offered outside an upgrade when the fix was requested by name', async () => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({ beforeVersion: undefined, requested: true })
      );
      expect(result).not.toBeNull();
    });

    it('is offered on a project already past the boundary when requested by name', async () => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({ beforeVersion: '10.5.0', storybookVersion: '10.6.0', requested: true })
      );
      expect(result).not.toBeNull();
    });

    it.each(['10.4.0', '9.1.0'])(
      'is never offered against Storybook %s, even when requested by name',
      async (storybookVersion) => {
        const result = await enableExperimentalDocgenServer.check(
          checkOptions({ storybookVersion, beforeVersion: undefined, requested: true })
        );
        expect(result).toBeNull();
      }
    );

    it.each([true, false])('is not offered when already explicitly set to %s', async (value) => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({ mainConfig: withFeatures({ experimentalDocgenServer: value }) })
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
        checkOptions({ mainConfig: withFeatures({ changeDetection: false }) })
      );
      expect(result).toBeNull();
    });
  });

  describe('docgen provider requirement', () => {
    it.each([
      ['@storybook/react-vite', true],
      ['@storybook/nextjs', true],
      ['@storybook/react-webpack5', true],
      ['@storybook/vue3-vite', true],
      ['@storybook/angular-vite', true],
      ['@storybook/svelte-vite', false],
      ['@storybook/web-components-vite', false],
      ['@storybook/preact-vite', false],
      ['@storybook/angular', false],
    ])('%s offers enable-experimental-docgen-server: %s', async (framework, expected) => {
      const result = await enableExperimentalDocgenServer.check(
        checkOptions({ mainConfig: { framework: { name: framework } } as StorybookConfigRaw })
      );
      expect(result !== null).toBe(expected);
    });

    it('offers enable-experimental-review regardless of the docgen provider', async () => {
      const result = await enableExperimentalReview.check(
        checkOptions({
          mainConfig: { framework: { name: '@storybook/svelte-vite' } } as StorybookConfigRaw,
        })
      );
      expect(result).not.toBeNull();
    });
  });

  describe('resolveRequestedFeatures', () => {
    it('maps supported flag names onto their fixes', () => {
      expect(resolveRequestedFeatures('experimentalReview, experimentalDocgenServer')).toEqual([
        { name: 'experimentalReview', fixId: enableExperimentalReview.id },
        { name: 'experimentalDocgenServer', fixId: enableExperimentalDocgenServer.id },
      ]);
    });

    it('returns nothing when no flags were requested', () => {
      expect(resolveRequestedFeatures(undefined)).toEqual([]);
    });

    it.each(['experimentalRevieww', 'constructor', 'toString', '__proto__'])(
      'rejects %s',
      (name) => {
        expect(() => resolveRequestedFeatures(name)).toThrow(
          `Unknown feature flag(s): ${name}. Available: experimentalReview, experimentalDocgenServer.`
        );
      }
    );
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
