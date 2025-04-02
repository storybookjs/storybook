import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

interface AddStorybookOverridesOptions {
  packageJsonPaths: string[];
}

const NPM_LOCKFILE = 'package-lock.json';

/**
 * Migration to add Storybook overrides to package.json files when using npm
 *
 * - Only runs if npm is detected (via package-lock.json files)
 * - Only adds overrides to package.json files that contain Storybook dependencies
 */
export const addStorybookOverrides: Fix<AddStorybookOverridesOptions> = {
  id: 'add-storybook-overrides',
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

  async check() {
    const projectRoot = getProjectRoot();
    // eslint-disable-next-line depend/ban-dependencies
    const globby = (await import('globby')).globby;

    // First check if npm is being used by looking for package-lock.json files
    const npmLockfiles = await globby(['**/package-lock.json'], {
      ignore: ['**/node_modules/**'],
      cwd: projectRoot,
      gitignore: true,
    });

    if (npmLockfiles.length === 0) {
      return null;
    }

    // Find all package.json files that have Storybook dependencies
    const packageJsonFiles = await globby(['**/package.json'], {
      ignore: ['**/node_modules/**'],
      cwd: projectRoot,
      gitignore: true,
      absolute: true,
    });

    const packageJsonsWithStorybook = [];

    for (const packageJsonPath of packageJsonFiles) {
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
        const allDeps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {}),
        };

        // Check if any dependency starts with @storybook/
        const hasStorybookDeps = Object.keys(allDeps).some((dep) => dep.startsWith('@storybook/'));
        if (hasStorybookDeps) {
          packageJsonsWithStorybook.push(packageJsonPath);
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }

    if (packageJsonsWithStorybook.length === 0) {
      return null;
    }

    return {
      packageJsonPaths: packageJsonsWithStorybook,
    };
  },

  prompt({ packageJsonPaths }) {
    return dedent`We've detected that you're using ${picocolors.yellow('npm')} and have Storybook dependencies in the following package.json files:${packageJsonPaths.map((path) => `\n- ${picocolors.cyan(path)}`).join('')}

We'll add Storybook overrides to these package.json files to ensure consistent dependency resolution.`;
  },

  async run({ result, dryRun }) {
    const { packageJsonPaths } = result;

    for (const packageJsonPath of packageJsonPaths) {
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

        // Add overrides section if it doesn't exist
        if (!packageJson.overrides) {
          packageJson.overrides = {};
        }

        // Add Storybook overrides
        packageJson.overrides.storybook = '^9.0.0';

        if (!dryRun) {
          await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        }
      } catch (err) {
        // Skip files that can't be read/written
      }
    }
  },
};
