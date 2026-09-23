import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile, writeFile } from 'node:fs/promises';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import type { CheckOptions, RunOptions } from '../types.ts';
import { removeLegacyDecoratorFileOrder } from './remove-legacy-decorator-file-order.ts';

vi.mock('node:fs/promises', { spy: true });

const MAIN_CONFIG_PATH = '/project/.storybook/main.ts';

const mainWithFlag = (featuresBody: string) =>
  `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  features: {
    ${featuresBody}
  },
};
export default config;
`;

const checkOptions = (overrides: Partial<CheckOptions> = {}): CheckOptions =>
  ({
    mainConfigPath: MAIN_CONFIG_PATH,
    mainConfig: { framework: { name: '@storybook/react-vite' } },
    storybookVersion: '11.0.0',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
    ...overrides,
  }) as CheckOptions;

const runOptions = (dryRun: boolean): RunOptions<object> =>
  ({ mainConfigPath: MAIN_CONFIG_PATH, dryRun }) as RunOptions<object>;

describe('remove-legacy-decorator-file-order', () => {
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
    it('returns null without a main config path', async () => {
      const result = await removeLegacyDecoratorFileOrder.check(
        checkOptions({ mainConfigPath: undefined })
      );
      expect(result).toBeNull();
    });

    it('returns null when the flag is absent', async () => {
      vol.fromJSON({
        [MAIN_CONFIG_PATH]: mainWithFlag('experimentalReview: true,'),
      });

      const result = await removeLegacyDecoratorFileOrder.check(checkOptions());
      expect(result).toBeNull();
    });

    it('detects the flag when it is true', async () => {
      vol.fromJSON({
        [MAIN_CONFIG_PATH]: mainWithFlag('legacyDecoratorFileOrder: true,'),
      });

      const result = await removeLegacyDecoratorFileOrder.check(checkOptions());
      expect(result).toEqual({});
    });

    it('detects the flag when it is false', async () => {
      vol.fromJSON({
        [MAIN_CONFIG_PATH]: mainWithFlag('legacyDecoratorFileOrder: false,'),
      });

      const result = await removeLegacyDecoratorFileOrder.check(checkOptions());
      expect(result).toEqual({});
    });
  });

  describe('run', () => {
    it('removes the flag and keeps other features', async () => {
      vol.fromJSON({
        [MAIN_CONFIG_PATH]: mainWithFlag(`legacyDecoratorFileOrder: true,
    experimentalReview: true,`),
      });

      await removeLegacyDecoratorFileOrder.run!(runOptions(false));

      const written = memfs.fs.readFileSync(MAIN_CONFIG_PATH, 'utf-8') as string;
      expect(written).not.toContain('legacyDecoratorFileOrder');
      expect(written).toMatch(/features:\s*{\s*experimentalReview:\s*true/);
    });

    it('removes the features object when the flag was the only entry', async () => {
      vol.fromJSON({
        [MAIN_CONFIG_PATH]: mainWithFlag('legacyDecoratorFileOrder: true,'),
      });

      await removeLegacyDecoratorFileOrder.run!(runOptions(false));

      const written = memfs.fs.readFileSync(MAIN_CONFIG_PATH, 'utf-8') as string;
      expect(written).not.toContain('legacyDecoratorFileOrder');
      expect(written).not.toContain('features:');
    });

    it('leaves the file untouched on a dry run', async () => {
      const source = mainWithFlag('legacyDecoratorFileOrder: true,');
      vol.fromJSON({ [MAIN_CONFIG_PATH]: source });

      await removeLegacyDecoratorFileOrder.run!(runOptions(true));

      expect(memfs.fs.readFileSync(MAIN_CONFIG_PATH, 'utf-8')).toBe(source);
    });
  });
});
