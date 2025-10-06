import { readFileSync, writeFileSync } from 'fs';

import { findFilesUp } from '../../util';
import type { Fix } from '../types';

interface AddonExperimentalTestOptions {
  matchingFiles: string[];
}

/**
 * This fix migrates users from @storybook/experimental-addon-test to @storybook/addon-vitest
 *
 * It will:
 *
 * - Replace all instances of @storybook/experimental-addon-test with @storybook/addon-vitest in all
 *   project files
 * - Update package.json dependencies if needed
 */
export const addonExperimentalTest: Fix<AddonExperimentalTestOptions> = {
  id: 'addon-experimental-test',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#experimental-test-addon-stabilized-and-renamed',

  promptType: 'auto',

  async check({ packageManager }) {
    const isExperimentalAddonTestInstalled = await packageManager.isPackageInstalled(
      '@storybook/experimental-addon-test'
    );

    if (!isExperimentalAddonTestInstalled) {
      return null;
    }

    const matchingFiles = findFilesUp(
      ['.storybook/**/*.*', 'vitest.*.{js,ts,mjs,cjs}', 'vite.config.{js,ts,mjs,cjs}'],
      packageManager.instanceDir
    );

    const filesWithExperimentalAddon = [];

    for (const file of matchingFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('@storybook/experimental-addon-test')) {
          filesWithExperimentalAddon.push(file);
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return {
      matchingFiles: filesWithExperimentalAddon,
    };
  },

  prompt() {
    return "We'll migrate @storybook/experimental-addon-test to @storybook/addon-vitest";
  },

  async run({ result: { matchingFiles }, packageManager, dryRun, storybookVersion }) {
    // Update all files that contain @storybook/experimental-addon-test
    for (const file of matchingFiles) {
      const content = readFileSync(file, 'utf-8');
      let updatedContent = content.replace(
        /@storybook\/experimental-addon-test/g,
        '@storybook/addon-vitest'
      );

      if (file.includes('vitest.setup')) {
        updatedContent = updatedContent.replace(/^\s*beforeAll.*\n?/gm, '');
      }

      if (!dryRun) {
        writeFileSync(file, updatedContent, 'utf-8');
      }
    }

    // Update package.json if needed
    if (!dryRun) {
      await packageManager.removeDependencies(['@storybook/experimental-addon-test']);
      await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
        `@storybook/addon-vitest@${storybookVersion}`,
      ]);
    }
  },
};
