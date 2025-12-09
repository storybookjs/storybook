import { readFile, writeFile } from 'node:fs/promises';

import { transformImportFiles } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import type { Fix } from '../types';

const VITE_DEFAULT_VERSION = '^7.0.0';

interface NextjsToNextjsViteOptions {
  hasNextjsPackage: boolean;
  packageJsonFiles: string[];
}

const transformMainConfig = async (mainConfigPath: string, dryRun: boolean): Promise<boolean> => {
  try {
    const content = await readFile(mainConfigPath, 'utf-8');

    // Check if the file contains @storybook/nextjs references
    if (!content.includes('@storybook/nextjs')) {
      return false;
    }

    // Replace @storybook/nextjs with @storybook/nextjs-vite in the content
    const transformedContent = content.replace(/@storybook\/nextjs/g, '@storybook/nextjs-vite');

    if (transformedContent !== content && !dryRun) {
      await writeFile(mainConfigPath, transformedContent);
    }

    return transformedContent !== content;
  } catch (error) {
    logger.error(`Failed to update main config at ${mainConfigPath}: ${error}`);
    return false;
  }
};

export const nextjsToNextjsVite: Fix<NextjsToNextjsViteOptions> = {
  id: 'nextjs-to-nextjs-vite',
  link: 'https://storybook.js.org/docs/get-started/frameworks/nextjs-vite',
  defaultSelected: false,

  async check({ packageManager }): Promise<NextjsToNextjsViteOptions | null> {
    const allDeps = packageManager.getAllDependencies();

    // Check if @storybook/nextjs is present
    if (!allDeps['@storybook/nextjs']) {
      return null;
    }

    // Find package.json files that contain @storybook/nextjs
    const packageJsonFiles: string[] = [];

    for (const packageJsonPath of packageManager.packageJsonPaths) {
      try {
        const content = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);

        const hasNextjs = Object.keys({
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {}),
        }).includes('@storybook/nextjs');

        if (hasNextjs) {
          packageJsonFiles.push(packageJsonPath);
        }
      } catch {
        // Skip invalid package.json files
        continue;
      }
    }

    return {
      hasNextjsPackage: true,
      packageJsonFiles,
    };
  },

  prompt() {
    return 'Migrate from @storybook/nextjs to @storybook/nextjs-vite (Vite framework)';
  },

  async run({
    result,
    dryRun = false,
    mainConfigPath,
    storiesPaths,
    configDir,
    packageManager,
    storybookVersion,
  }) {
    if (!result) {
      return;
    }

    logger.step('Migrating from @storybook/nextjs to @storybook/nextjs-vite...');

    // Update package.json files
    if (dryRun) {
      logger.debug('Dry run: Skipping package.json updates.');
    } else {
      logger.debug('Updating package.json files...');
      const viteVersion = packageManager.getDependencyVersion('vite');
      await packageManager.removeDependencies(['@storybook/nextjs']);
      await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
        `@storybook/nextjs-vite@${storybookVersion}`,
        ...(viteVersion ? [] : [`vite@${VITE_DEFAULT_VERSION}`]), // Add vite if it's not installed yet
      ]);
    }

    // Update main config file
    if (mainConfigPath) {
      logger.debug('Updating main config file...');
      await transformMainConfig(mainConfigPath, dryRun);
    }

    // Scan and transform import statements in source files
    logger.debug('Scanning and updating import statements...');

    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const configFiles = await globby([`${configDir}/**/*`]);
    const allFiles = [...storiesPaths, ...configFiles].filter(Boolean) as string[];

    const transformErrors = await transformImportFiles(
      allFiles,
      {
        '@storybook/nextjs': '@storybook/nextjs-vite',
      },
      !!dryRun
    );

    if (transformErrors.length > 0) {
      logger.warn(`Encountered ${transformErrors.length} errors during file transformation:`);
      transformErrors.forEach(({ file, error }) => {
        logger.warn(`  - ${file}: ${error.message}`);
      });
    }

    logger.step('Migration completed successfully!');
    logger.log(
      `For more information, see: https://storybook.js.org/docs/nextjs/get-started/nextjs-vite`
    );
  },
};
