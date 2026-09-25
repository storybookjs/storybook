import { transformImports } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import type { Fix } from '../types.ts';

export const VITE_DEFAULT_VERSION = '^7.0.0';

interface NextjsToNextjsViteOptions {
  hasNextjsPackage: boolean;
  packageJsonFiles: string[];
}

export const nextjsToNextjsVite: Fix<NextjsToNextjsViteOptions> = {
  id: 'nextjs-to-nextjs-vite',
  link: 'https://storybook.js.org/docs/get-started/frameworks/nextjs-vite',
  defaultSelected: false,

  async check({ packageManager, files }): Promise<NextjsToNextjsViteOptions | null> {
    const allDeps = packageManager.getAllDependencies();

    // Check if @storybook/nextjs is present
    if (!allDeps['@storybook/nextjs']) {
      return null;
    }

    // Find package.json files that contain @storybook/nextjs
    const packageJsonFiles: string[] = [];

    for (const packageJsonPath of packageManager.packageJsonPaths) {
      try {
        const content = await files.read(packageJsonPath);
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

  async run({ files, mainConfigPath, storiesPaths, configDir, packageManager, storybookVersion }) {
    logger.step('Migrating from @storybook/nextjs to @storybook/nextjs-vite...');

    // The negative lookahead keeps existing @storybook/nextjs-vite references intact
    await files.edit(mainConfigPath, (source) =>
      source.replace(/@storybook\/nextjs(?!-vite)/g, '@storybook/nextjs-vite')
    );

    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const configFiles = await globby([`${configDir}/**/*`]);
    await files.edit([...storiesPaths, ...configFiles], (source) =>
      transformImports(source, { '@storybook/nextjs': '@storybook/nextjs-vite' })
    );

    const viteVersion = packageManager.getDependencyVersion('vite');
    await packageManager.removeDependencies(['@storybook/nextjs']);
    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      `@storybook/nextjs-vite@${storybookVersion}`,
      ...(viteVersion ? [] : [`vite@${VITE_DEFAULT_VERSION}`]), // Add vite if it's not installed yet
    ]);

    logger.step('Migration completed successfully!');
    logger.log(
      `For more information, see: https://storybook.js.org/docs/get-started/frameworks/nextjs-vite`
    );
  },
};
