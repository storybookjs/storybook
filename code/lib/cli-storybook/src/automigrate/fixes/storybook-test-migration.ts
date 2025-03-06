import { readFile, writeFile } from 'node:fs/promises';

import picocolors from 'picocolors';
import prompts from 'prompts';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

interface StorybookTestMigrationResult {
  hasDependency: boolean;
  defaultGlob: string;
}

export const storybookTestMigration: Fix<StorybookTestMigrationResult> = {
  id: 'storybook-test-migration',
  versionRange: ['<9.0.0', '>=9.0.0-0'],
  check: async ({ packageManager, configDir }) => {
    const storybookTestPackageVersion = await packageManager.getPackageVersion('@storybook/test');

    if (!storybookTestPackageVersion) {
      return null;
    }

    // Default glob pattern to scan for files
    const defaultGlob = `{${configDir}/**/*,**/*.{stories.*,test.*}}`;

    return {
      hasDependency: !!storybookTestPackageVersion,
      defaultGlob,
    };
  },
  prompt: (result) => {
    return dedent`
      We detected that you're using ${picocolors.magenta('@storybook/test')} in your project. This package has been merged into ${picocolors.magenta('storybook/test')}.
      
      We'll help you migrate by:
      1. Removing ${picocolors.magenta('@storybook/test')} from your dependencies
      2. Updating all imports from ${picocolors.magenta('@storybook/test')} to ${picocolors.magenta('storybook/test')}
      
      We'll scan the following files:
      - All files in .storybook directory
      - All *.stories.* files
      - All *.test.* files
      
      The default glob pattern we'll use is: ${picocolors.yellow(result.defaultGlob)}
      
      In the next step, you can provide a custom glob pattern to fine-tune the files we'll scan.
    `;
  },
  promptType: 'auto',
  run: async ({ packageManager, dryRun, result }) => {
    // Remove @storybook/test from dependencies
    if (!dryRun) {
      await packageManager.removeDependencies({}, ['@storybook/test']);
    }

    // Find all files matching the glob pattern
    const { glob } = await prompts({
      type: 'text',
      name: 'glob',
      message: 'Enter a custom glob pattern to scan (or press enter to use default):',
      initial: result.defaultGlob,
    });

    // eslint-disable-next-line depend/ban-dependencies
    const globby = (await import('globby')).globby;

    const files = await globby(glob, {
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
      cwd: process.cwd(),
      gitignore: true,
    });

    let updatedFilesCount = 0;

    // Process each file
    for (const file of files) {
      const content = await readFile(file, 'utf-8');

      // Replace imports
      const updatedContent = content.replace(/(['"])@storybook\/test\1/g, '$1storybook/test$1');

      if (content !== updatedContent) {
        if (!dryRun) {
          await writeFile(file, updatedContent);
        }
        // Track updated files count to show at the end
        updatedFilesCount = (updatedFilesCount || 0) + 1;
      }
    }

    console.log(`Updated ${updatedFilesCount} files`);
  },
};
