import path from 'path';

import { describe, expect, it } from 'vitest';

import { getStorybookSubpathImportTarget } from './csf-factories.ts';

describe('csf-factories command', () => {
  describe('getStorybookSubpathImportTarget', () => {
    it('scopes the imports map target to the Storybook config directory', () => {
      const packageJsonDir = path.resolve(path.sep, 'project');

      expect(
        getStorybookSubpathImportTarget(path.join(packageJsonDir, '.storybook'), packageJsonDir)
      ).toBe('./.storybook/*');
      expect(
        getStorybookSubpathImportTarget(
          path.join(packageJsonDir, 'config', 'storybook'),
          packageJsonDir
        )
      ).toBe('./config/storybook/*');
    });
  });
});
