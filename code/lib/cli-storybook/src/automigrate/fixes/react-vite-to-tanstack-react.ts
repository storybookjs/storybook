import { readFile, writeFile } from 'node:fs/promises';

import { transformImportFiles } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types.ts';

export const REACT_VITE_PACKAGE = '@storybook/react-vite';
export const TANSTACK_REACT_PACKAGE = '@storybook/tanstack-react';

interface ReactViteToTanstackReactOptions {
  hasReactVitePackage: boolean;
  hasTanstackRouter: boolean;
  packageJsonFiles: string[];
  /** Whether the preview config appears to set up a TanStack Router decorator manually. */
  hasTanstackRouterDecorator: boolean;
}

/** Markers that strongly suggest a manual TanStack Router decorator is configured in preview/stories. */
const TANSTACK_ROUTER_DECORATOR_MARKERS = [
  'createMemoryHistory',
  'createRootRoute',
  'createRouter',
  'RouterProvider',
];

const TANSTACK_ROUTER_PACKAGES = [
  '@tanstack/react-router',
  '@tanstack/router-core',
  '@tanstack/start',
  '@tanstack/react-start',
];

const detectTanstackRouterDecorator = async (filePath: string | undefined): Promise<boolean> => {
  if (!filePath) {
    return false;
  }
  try {
    const content = await readFile(filePath, 'utf-8');
    const importsTanstackRouter = TANSTACK_ROUTER_PACKAGES.some((pkg) =>
      new RegExp(`from\\s+['"]${pkg.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}['"]`).test(content)
    );
    if (!importsTanstackRouter) {
      return false;
    }
    return TANSTACK_ROUTER_DECORATOR_MARKERS.some((marker) => content.includes(marker));
  } catch {
    return false;
  }
};

const transformMainConfig = async (mainConfigPath: string, dryRun: boolean): Promise<boolean> => {
  try {
    const content = await readFile(mainConfigPath, 'utf-8');

    if (!content.includes(REACT_VITE_PACKAGE)) {
      return false;
    }

    const transformedContent = content.replaceAll(REACT_VITE_PACKAGE, TANSTACK_REACT_PACKAGE);

    if (transformedContent !== content && !dryRun) {
      await writeFile(mainConfigPath, transformedContent);
    }

    return transformedContent !== content;
  } catch (error) {
    logger.error(`Failed to update main config at ${mainConfigPath}: ${error}`);
    return false;
  }
};

const buildAiMigrationPrompt = (previewConfigPath?: string) =>
  dedent`
    I am migrating a Storybook project from "${REACT_VITE_PACKAGE}" to "${TANSTACK_REACT_PACKAGE}".

    The new framework provides built-in TanStack Router support via a global decorator
    and route loader. Any decorators that wrap stories with a custom RouterProvider,
    createRouter, createMemoryHistory or createRootRoute setup are no longer needed and
    should be removed.

    Please:
    1. Open ${previewConfigPath ?? '.storybook/preview.{ts,tsx,js,jsx}'} and remove any
       decorator that creates or provides a TanStack Router (RouterProvider, createRouter,
       createMemoryHistory, createRootRoute) — keep unrelated decorators intact.
    2. In any *.stories.* file, remove decorators that provide a RouterProvider as well.
    3. Where stories rely on a specific route, prefer the framework's API:
         - "parameters.tanstack.router.route" on the story meta, or
         - "parameters.tanstack.router.route" on a story
       to point at the route the story should render under.
    4. Drop now-unused imports from "@tanstack/react-router" / "@tanstack/router-core"
       (e.g. RouterProvider, createMemoryHistory, createRouter, createRootRoute).
    5. Keep CSF factories syntax (definePreview / defineMain / meta.story) intact when
       present, and only update the framework string in main config to
       "${TANSTACK_REACT_PACKAGE}".

    Do not change anything unrelated to the TanStack Router decorator removal.
  `;

export const reactViteToTanstackReact: Fix<ReactViteToTanstackReactOptions> = {
  id: 'react-vite-to-tanstack-react',
  link: 'https://storybook.js.org/docs/get-started/frameworks/tanstack-react',
  defaultSelected: false,

  async check({
    packageManager,
    previewConfigPath,
  }): Promise<ReactViteToTanstackReactOptions | null> {
    const allDeps = packageManager.getAllDependencies();

    const hasReactVitePackage = !!allDeps[REACT_VITE_PACKAGE];
    const hasTanstackRouter = TANSTACK_ROUTER_PACKAGES.some((pkg) => !!allDeps[pkg]);

    if (!hasReactVitePackage || !hasTanstackRouter) {
      return null;
    }

    const packageJsonFiles: string[] = [];
    for (const packageJsonPath of packageManager.packageJsonPaths) {
      try {
        const content = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);
        const deps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {}),
        };
        if (Object.keys(deps).includes(REACT_VITE_PACKAGE)) {
          packageJsonFiles.push(packageJsonPath);
        }
      } catch {
        continue;
      }
    }

    const hasTanstackRouterDecorator = await detectTanstackRouterDecorator(previewConfigPath);

    return {
      hasReactVitePackage,
      hasTanstackRouter,
      packageJsonFiles,
      hasTanstackRouterDecorator,
    };
  },

  prompt() {
    return `Migrate from ${REACT_VITE_PACKAGE} to ${TANSTACK_REACT_PACKAGE} (TanStack Router-aware framework)`;
  },

  async run({
    result,
    dryRun = false,
    mainConfigPath,
    previewConfigPath,
    storiesPaths,
    configDir,
    packageManager,
    storybookVersion,
    yes,
  }) {
    if (!result) {
      return;
    }

    logger.step(`Migrating from ${REACT_VITE_PACKAGE} to ${TANSTACK_REACT_PACKAGE}...`);

    if (dryRun) {
      logger.debug('Dry run: Skipping package.json updates.');
    } else {
      logger.debug('Updating package.json files...');
      await packageManager.removeDependencies([REACT_VITE_PACKAGE]);
      await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
        `${TANSTACK_REACT_PACKAGE}@${storybookVersion}`,
      ]);
    }

    if (mainConfigPath) {
      logger.debug('Updating main config file...');
      await transformMainConfig(mainConfigPath, dryRun);
    }

    logger.debug('Scanning and updating import statements...');

    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const configFiles = await globby([`${configDir}/**/*`]);
    const allFiles = [...storiesPaths, ...configFiles].filter(Boolean) as string[];

    const transformErrors = await transformImportFiles(
      allFiles,
      {
        [REACT_VITE_PACKAGE]: TANSTACK_REACT_PACKAGE,
      },
      !!dryRun
    );

    if (transformErrors.length > 0) {
      logger.warn(`Encountered ${transformErrors.length} errors during file transformation:`);
      transformErrors.forEach(({ file, error }) => {
        logger.warn(`  - ${file}: ${error.message}`);
      });
    }

    if (result.hasTanstackRouterDecorator) {
      logger.logBox(
        dedent`
          We detected what looks like a manual TanStack Router decorator in
          ${picocolors.cyan(previewConfigPath ?? '.storybook/preview')}.

          ${picocolors.bold(TANSTACK_REACT_PACKAGE)} wraps every story in a TanStack Router
          automatically (see ${picocolors.yellow(
            'https://storybook.js.org/docs/get-started/frameworks/tanstack-react'
          )}), so that decorator is no longer needed and should be removed.
        `
      );

      const wantsAiPrompt = yes
        ? false
        : await prompt.confirm({
            message:
              'Would you like a ready-to-paste AI prompt to help remove the now-unused TanStack Router decorator?',
            initialValue: true,
          });

      if (wantsAiPrompt) {
        logger.logBox(buildAiMigrationPrompt(previewConfigPath), {
          title: 'Copy this prompt into your AI assistant',
        });
      }
    }

    logger.step('Migration completed successfully!');
    logger.log(
      `For more information, see: https://storybook.js.org/docs/get-started/frameworks/tanstack-react`
    );
  },
};
