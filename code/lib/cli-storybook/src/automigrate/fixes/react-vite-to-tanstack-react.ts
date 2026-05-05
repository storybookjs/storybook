import { readFile, writeFile } from 'node:fs/promises';

import { transformImportFiles } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { writeText } from 'tinyclip';
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

const fileLooksLikeTanstackRouterDecorator = (content: string): boolean => {
  const importsTanstackRouter = TANSTACK_ROUTER_PACKAGES.some((pkg) =>
    new RegExp(`from\\s+['"]${pkg.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}['"]`).test(content)
  );
  if (!importsTanstackRouter) {
    return false;
  }
  return TANSTACK_ROUTER_DECORATOR_MARKERS.some((marker) => content.includes(marker));
};

/**
 * Detect a manual TanStack Router decorator anywhere in the user's Storybook surface area:
 *
 * - The preview file itself
 * - Any file inside the Storybook config directory (decorators are often factored out into
 *   `./decorators.ts` or `./withRouter.tsx` and imported by `preview.ts`)
 * - Any *.stories.* file (per-story `decorators: [...]`)
 *
 * We can't trace arbitrary user imports outside the config dir, but covering these locations
 * catches the vast majority of real-world setups.
 */
const detectTanstackRouterDecorator = async ({
  previewConfigPath,
  configDir,
  storiesPaths,
}: {
  previewConfigPath: string | undefined;
  configDir: string | undefined;
  storiesPaths: string[];
}): Promise<boolean> => {
  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');

  const configFiles = configDir
    ? await globby([`${configDir}/**/*.{ts,tsx,js,jsx,mjs,cjs}`], {
        ignore: ['**/node_modules/**', '**/dist/**'],
      })
    : [];

  const candidateFiles = Array.from(
    new Set([...(previewConfigPath ? [previewConfigPath] : []), ...configFiles, ...storiesPaths])
  );

  for (const file of candidateFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      if (fileLooksLikeTanstackRouterDecorator(content)) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
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
    Migrate this Storybook project from "${REACT_VITE_PACKAGE}" to "${TANSTACK_REACT_PACKAGE}".

    The new framework wraps every story in a TanStack Router automatically, so any manual
    decorator that creates a RouterProvider / createRouter / createMemoryHistory /
    createRootRoute is no longer needed.

    Tasks:
    1. Remove TanStack Router decorators from ${previewConfigPath ?? '.storybook/preview.*'},
       any other file under .storybook/, and any *.stories.* file. The decorator may live in
       a separate module (e.g. .storybook/decorators.ts) and be imported into preview —
       remove it at the source plus the import + usage.
    2. Drop now-unused imports from @tanstack/react-router and @tanstack/router-core
       (RouterProvider, createRouter, createMemoryHistory, createRootRoute).
    3. For stories that need a specific route, use the framework API instead:
       "component: Route" on the story meta, or "parameters.tanstack.router.route" on a story.
    4. Preserve CSF factories syntax (definePreview / defineMain / meta.story) when present.
    5. Do not change anything unrelated to the TanStack Router decorator removal.
  `;

export const reactViteToTanstackReact: Fix<ReactViteToTanstackReactOptions> = {
  id: 'react-vite-to-tanstack-react',
  link: 'https://storybook.js.org/docs/get-started/frameworks/tanstack-react',
  defaultSelected: false,

  async check({
    packageManager,
    previewConfigPath,
    configDir,
    storiesPaths,
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
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };
        if (Object.keys(deps).includes(REACT_VITE_PACKAGE)) {
          packageJsonFiles.push(packageJsonPath);
        }
      } catch {
        continue;
      }
    }

    const hasTanstackRouterDecorator = await detectTanstackRouterDecorator({
      previewConfigPath,
      configDir,
      storiesPaths: storiesPaths ?? [],
    });

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
        const aiPrompt = buildAiMigrationPrompt(previewConfigPath);

        await writeText(aiPrompt);

        logger.logBox(
          dedent`AI migration prompt copied to clipboard! ${picocolors.dim(
            '(It can be pasted into Copilot or your preferred AI tool to generate code for removing the TanStack Router decorator.)'
          )}`
        );
      }
    }
    logger.step('Migration completed successfully!');
    logger.log(
      `For more information, see: https://storybook.js.org/docs/get-started/frameworks/tanstack-react`
    );
  },
};
