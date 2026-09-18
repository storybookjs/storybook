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
    You are migrating a Storybook project from the "${REACT_VITE_PACKAGE}" framework to the
    "${TANSTACK_REACT_PACKAGE}" framework. The framework swap in .storybook/main.* and the
    package.json dependency change have already been performed by the Storybook automigration
    CLI — do not redo those. Your job is to clean up the user-land code that the CLI cannot
    safely transform.

    Reference documentation:
    https://storybook.js.org/docs/get-started/frameworks/tanstack-react

    # Background

    "${TANSTACK_REACT_PACKAGE}" is a TanStack Router-aware Storybook framework built on top
    of @storybook/react-vite. It mounts every story inside a TanStack Router (in-memory
    history) automatically. Manual router setup that users previously wired into a
    decorator is now redundant and must be removed — leaving it in place creates a nested
    router and breaks stories.

    Telltale signs of a manual decorator that must be removed (any of these in
    preview / decorator / story files):
      - imports from "@tanstack/react-router", "@tanstack/router-core",
        "@tanstack/start", or "@tanstack/react-start" used to construct a router
      - calls to createMemoryHistory(...), createRootRoute(...), createRouter(...)
      - JSX usage of <RouterProvider router={...} />
      - a decorator function (e.g. const withRouter = (Story) => <RouterProvider .../>)
        wired into "decorators: [...]" of a meta or preview

    # The replacement APIs from "${TANSTACK_REACT_PACKAGE}"

    All of the following are exported from "${TANSTACK_REACT_PACKAGE}" — re-exporting the
    @storybook/react primitives plus the TanStack-specific additions. Use these instead of
    a hand-rolled router decorator. Only opt in when a story actually needs a specific
    route — by default the framework's auto-router is enough.

    1) Preview-level default route (CSF factories — recommended).

       In ${previewConfigPath ?? '.storybook/preview.*'}:

         import { definePreview } from '@storybook/tanstack-react';
         import { routeTree } from '../src/routeTree.gen'; // or a custom Route

         export default definePreview({
           // optional — registers a default route for every story in the project
           route: routeTree,
           parameters: { /* ... */ },
         });

    2) Per-meta route via "parameters.tanstack.router" (works with both CSF factories
       and CSF3). Most TanStack-Router-decorator removals translate to this:

         // CSF factories style (preferred when the project already uses preview.meta):
         import preview from '#.storybook/preview';
         import { Route } from './Page';

         const meta = preview.meta({
           title: 'Example/Page',
           parameters: {
             tanstack: {
               router: {
                 route: Route,
               },
             },
           },
         });

         export const Default = meta.story();

         // CSF3 style:
         import type { Meta, StoryObj } from '@storybook/tanstack-react';
         import { Route } from './Page';

         const meta = {
           title: 'Example/Page',
           parameters: {
             tanstack: { router: { route: Route } },
           },
         } satisfies Meta<typeof Route>;

         export default meta;
         export const Default: StoryObj<typeof meta> = {};

    3) Per-story override — same shape, but on a single story's "parameters" instead of
       the meta. Useful when one story needs a different route than the others.

    4) Additional "parameters.tanstack.router" fields you can use when needed:
         - "path"           initial pathname (e.g. '/users/$id')
         - "params"         URL params object (typed against the route)
         - "query"          search params object (typed against the route)
         - "routeOverrides" map of route id -> { loader / beforeLoad / validateSearch / ... }
                            for mocking specific routes in the registered tree
         - "useRouterContext" function that returns a custom router context per story

       Do NOT introduce any of these unless the original decorator was clearly setting up
       that exact behavior. Remove the decorator first; only port over the bits that were
       actually doing work.

    5) Type imports. If the project uses CSF3 types, switch them from "@storybook/react"
       (or "@storybook/react-vite") to "@storybook/tanstack-react":

         - import type { Meta, StoryObj } from '@storybook/react';
         + import type { Meta, StoryObj } from '@storybook/tanstack-react';

       The TanStack-aware "Meta" infers TanStack parameter types from the route in
       "component" / parameters, giving type-safe params/query.

    # Tasks (perform in order, in the user's repository)

    1. Open ${previewConfigPath ?? '.storybook/preview.*'} and remove any TanStack Router
       decorator from the "decorators" array. The decorator may be:
         - defined inline in this file, or
         - imported from another module (commonly .storybook/decorators.ts,
           .storybook/withRouter.tsx, or similar) — in that case remove BOTH the
           import + usage here AND delete the decorator definition at its source.
       If the source decorator file becomes empty after removal, delete the file.

       Confirm "definePreview" is imported from "@storybook/tanstack-react" (not
       "@storybook/react" or "@storybook/react-vite"). If the project has a single
       project-wide route to register, pass it via "definePreview({ route })".

    2. Search the whole repository (not just .storybook/) for any *.stories.* file that
       declares a per-story or per-meta TanStack Router decorator and remove it. If the
       removed decorator was setting up a specific route, port that to
       "parameters.tanstack.router" using the APIs above (route / path / params / query /
       routeOverrides — whichever applies).

    3. Drop now-unused imports of: RouterProvider, createRouter, createMemoryHistory,
       createRootRoute, Outlet (from "@tanstack/react-router" / "@tanstack/router-core" /
       "@tanstack/start" / "@tanstack/react-start"). Keep imports that are still
       legitimately used elsewhere in the file (Link, useNavigate, createRoute when used
       to build a Route passed to "parameters.tanstack.router.route", etc.).

    4. Update story-type imports from "@storybook/react" / "@storybook/react-vite" to
       "@storybook/tanstack-react" wherever the story uses TanStack router parameters,
       so the types pick up the TanStack additions.

    5. Preserve CSF factories syntax. If the file uses
       "definePreview({...})" / "preview.meta({...})" / "meta.story(...)", keep that shape;
       only mutate the affected fields. Do not rewrite CSF1/CSF2/CSF3 -> CSF factories or
       vice versa.

    6. Preserve all other decorators, parameters, args, argTypes, loaders, beforeEach,
       tags, and globals exactly as they were. Only the TanStack Router decorator is
       being removed.

    7. Do not edit .storybook/main.*, package.json, or any lockfile — those are already
       handled by the automigration CLI.

    # Verification checklist before finishing

      - No remaining manual "RouterProvider", "createRouter", "createMemoryHistory",
        "createRootRoute" usage in preview, .storybook/**, or *.stories.*.
      - "decorators" arrays no longer contain the removed TanStack Router decorator.
      - All previously imported router symbols that are no longer referenced are gone.
      - Story files importing TanStack-aware types use "@storybook/tanstack-react".
      - TypeScript still compiles. Storybook still loads. Stories that don't need a
        specific route now rely on the framework's default in-memory router; stories
        that do specify a route do so via "parameters.tanstack.router".
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

    const hasTanstackRouterDecorator = await detectTanstackRouterDecorator({
      previewConfigPath,
      configDir,
      storiesPaths: storiesPaths ?? [],
    });

    return {
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
    const configFiles = configDir
      ? await globby([`${configDir}/**/*.{ts,tsx,js,jsx,mjs,cjs}`], {
          ignore: ['**/node_modules/**', '**/dist/**'],
        })
      : [];
    const allFiles = [...storiesPaths, ...configFiles, previewConfigPath].filter(
      Boolean
    ) as string[];

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
        ? true
        : await prompt.confirm({
            message:
              'Would you like a ready-to-paste AI prompt to help remove the now-unused TanStack Router decorator?',
            initialValue: true,
          });

      if (wantsAiPrompt) {
        const aiPrompt = buildAiMigrationPrompt(previewConfigPath);
        const separator = picocolors.dim('─'.repeat(60));

        let clipboardOk = false;
        try {
          await writeText(aiPrompt);
          clipboardOk = true;
        } catch {
          // Clipboard access can fail in CI / headless Linux environments where the
          // platform helper (e.g. `xclip`) isn't installed. We fall back to printing
          // only — the prompt is logged below either way.
        }

        // Always log the prompt so coding agents running this automigration can read it
        // directly from stdout (no clipboard available in agentic environments). Humans
        // benefit too: the clipboard contents are visible for verification.
        logger.logBox(
          dedent`${
            clipboardOk
              ? 'AI migration prompt copied to clipboard. Full prompt below:'
              : 'Clipboard not available in this environment. Copy the AI migration prompt below manually:'
          }

            ${separator}
            ${aiPrompt}
            ${separator}`
        );
      }
    }
    logger.step('Migration completed successfully!');
    logger.log(
      `For more information, see: https://storybook.js.org/docs/get-started/frameworks/tanstack-react`
    );
  },
};
