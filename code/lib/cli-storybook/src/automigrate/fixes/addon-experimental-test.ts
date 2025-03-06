import { readFileSync, writeFileSync } from 'fs';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

const logger = console;

interface AddonExperimentalTestOptions {
  matchingFiles: string[];
}

/**
 * This fix migrates users from @storybook/experimental-addon-test to @storybook/addon-test
 *
 * It will:
 *
 * - Replace all instances of @storybook/experimental-addon-test with @storybook/addon-test in all
 *   project files
 * - Update package.json dependencies if needed
 */
export const addonExperimentalTest: Fix<AddonExperimentalTestOptions> = {
  id: 'addon-experimental-test',

  versionRange: ['*', '*'],

  promptType: 'auto',

  async check({ packageManager }) {
    const experimentalAddonTestVersion = await packageManager.getPackageVersion(
      '@storybook/experimental-addon-test'
    );

    if (!experimentalAddonTestVersion) {
      return null;
    }

    // Dynamically import fast-glob to find files
    // eslint-disable-next-line depend/ban-dependencies
    const { globbySync } = await import('globby');

    // Find all files that contain @storybook/experimental-addon-test
    const matchingFiles = globbySync(
      ['**/.storybook/**/*.*', '**/vitest.*.{js,ts,mjs,cjs}', '**/vite.config.{js,ts,mjs,cjs}'],
      {
        ignore: ['**/node_modules/**', '**/dist/**'],
      }
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

  prompt({ matchingFiles }) {
    const fileCount = matchingFiles.length;
    const fileList = matchingFiles
      .slice(0, 5)
      .map((file) => `  - ${picocolors.cyan(file)}`)
      .join('\n');
    const hasMoreFiles = fileCount > 5;

    return dedent`
      We've detected you're using ${picocolors.cyan('@storybook/experimental-addon-test')}, which is now available as a stable addon.
      
      We can automatically migrate your project to use ${picocolors.cyan('@storybook/addon-test')} instead.
      
      This will update ${fileCount} file(s) and your package.json:
      ${fileList}${hasMoreFiles ? `\n  ... and ${fileCount - 5} more files` : ''}
    `;
  },

  async run({ result: { matchingFiles }, packageManager, dryRun }) {
    // Update all files that contain @storybook/experimental-addon-test
    for (const file of matchingFiles) {
      const content = readFileSync(file, 'utf-8');
      const updatedContent = content.replace(
        /@storybook\/experimental-addon-test/g,
        '@storybook/addon-test'
      );

      if (!dryRun) {
        writeFileSync(file, updatedContent, 'utf-8');
      }
    }

    // Update package.json if needed
    if (!dryRun) {
      const packageJson = await packageManager.retrievePackageJson();
      const devDependencies = packageJson.devDependencies ?? {};
      const storybookVersion = await packageManager.getPackageVersion('storybook');
      const isExperimentalAddonTestDevDependency = Object.keys(devDependencies).includes(
        '@storybook/experimental-addon-test'
      );

      await packageManager.removeDependencies({}, ['@storybook/experimental-addon-test']);
      await packageManager.addDependencies(
        { installAsDevDependencies: isExperimentalAddonTestDevDependency },
        [`@storybook/addon-test@${storybookVersion}`]
      );
    }

    // Log success message instead of returning it
    logger.info(dedent`
      ✅ Successfully migrated from ${picocolors.cyan('@storybook/experimental-addon-test')} to ${picocolors.cyan('@storybook/addon-test')}
      ✅ Updated package.json dependency
      ✅ Updated ${matchingFiles.length} file(s)
    `);
  },
};
