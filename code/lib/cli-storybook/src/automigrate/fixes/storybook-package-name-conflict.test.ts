import { describe, expect, it } from 'vitest';

import type { StorybookConfigRaw } from 'storybook/internal/types';

import { makePackageManager } from '../helpers/testing-helpers';
import { storybookPackageNameConflict } from './storybook-package-name-conflict';

const mockMainConfig: StorybookConfigRaw = {
  stories: [],
};

const check = async (packageName: string) => {
  return storybookPackageNameConflict.check({
    packageManager: makePackageManager({ name: packageName }),
    mainConfig: mockMainConfig,
    storybookVersion: '8.0.0',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
  });
};

describe('storybookPackageNameConflict', () => {
  describe('check', () => {
    it('detects when package name is "storybook"', async () => {
      await expect(check('storybook')).resolves.toEqual({
        packageName: 'storybook',
      });
    });

    it('returns null when package name is something else', async () => {
      await expect(check('my-cool-app')).resolves.toBeNull();
    });

    it('returns null when package name is undefined', async () => {
      const result = await storybookPackageNameConflict.check({
        packageManager: makePackageManager({}),
        mainConfig: mockMainConfig,
        storybookVersion: '8.0.0',
        storiesPaths: [],
        hasCsfFactoryPreview: false,
      });
      expect(result).toBeNull();
    });
  });

  describe('prompt', () => {
    it('includes relevant information about the conflict', () => {
      const message = storybookPackageNameConflict.prompt();
      expect(message).toContain('storybook');
      expect(message).toContain('node_modules/storybook');
      expect(message).toContain('rename');
    });
  });
});
