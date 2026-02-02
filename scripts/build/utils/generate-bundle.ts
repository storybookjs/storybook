/* eslint-disable local-rules/no-uncategorized-errors */
import { existsSync, watch } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import * as esbuild from 'esbuild';
import { basename, join, relative } from 'pathe';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { globalsModuleInfoMap } from '../../../code/core/src/manager/globals/globals-module-info';
import {
  BROWSER_TARGETS,
  NODE_TARGET,
  SUPPORTED_FEATURES,
} from '../../../code/core/src/shared/constants/environments-support';
import { resolvePackageDir } from '../../../code/core/src/shared/utils/module';
import {
  type BuildEntries,
  type EntryType,
  type EsbuildContextOptions,
  getExternal,
} from './entry-utils';

// repo root/bench/esbuild-metafiles/core
const DIR_METAFILE_BASE = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'code',
  'bench',
  'esbuild-metafiles'
);
export const DIR_CODE = join(import.meta.dirname, '..', '..', '..', 'code');

/*
 * This plugin writes the metafile to a file in the output directory.
 * It is used to analyze the bundle size of the different entry points.
 * The outputDir must be the package's directory, as that is the projectName in the NX config,
 * and what will become part of the build output cache. If there is a mismatch,
 * the metafiles won't be available whenever NX uses its cached results of the build step.
 */
function metafileWriterPlugin(entryType: EntryType, outputDir: string): esbuild.Plugin {
  return {
    name: 'metafile-writer',
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length || !result.metafile) {
          return;
        }
        const outputFile = join(outputDir, `${entryType}.json`);
        if (existsSync(outputFile)) {
          await rm(outputFile, { force: true });
        }
        await mkdir(outputDir, { recursive: true });
        await writeFile(outputFile, JSON.stringify(result.metafile, null, 2));
      });
    },
  };
}

export async function generateBundle({
  cwd,
  entry,
  isWatch,
}: {
  cwd: string;
  entry: BuildEntries;
  name: string;
  isWatch: boolean;
}) {
  const DIR_CWD = cwd;
  const DIR_REL = relative(DIR_CODE, DIR_CWD);
  const PACKAGE_DIR_NAME = basename(DIR_CWD);
  const external = (await getExternal(DIR_CWD)).runtimeExternal;
  const { entries, postbuild } = entry;

  const sharedOptions = {
    absWorkingDir: DIR_CWD,
    format: 'esm',
    bundle: true,
    legalComments: 'none',
    ignoreAnnotations: true,
    splitting: true,
    metafile: true,
    outbase: 'src',
    outdir: 'dist',
    treeShaking: true,
    color: true,
    external,
    minifySyntax: true,
    define: {
      /*
       * We need to disable the default behavior of replacing process.env.NODE_ENV with "development"
       * Because we have code that reads this value to determine if the code is running in a production environment.
       * @see 6th bullet in "browser" section in https://esbuild.github.io/api/#platform
       */
      'process.env.NODE_ENV': 'process.env.NODE_ENV',
    },
    plugins: [
      {
        name: 'postbuild',
        setup(build) {
          build.onEnd(async (result) => {
            if (!postbuild) {
              return;
            }
            if (result.errors.length) {
              console.log('Errors found, skipping postbuild');
              return;
            }
            console.log('Running postbuild script');
            await postbuild(DIR_CWD);
          });
        },
      },
    ],
  } as const satisfies EsbuildContextOptions;

  const runtimeOptions = {
    ...sharedOptions,
    platform: 'browser',
    target: BROWSER_TARGETS,
    supported: SUPPORTED_FEATURES,
    splitting: false,
    external: [
      // The following modules are conditionally called inside of @vitest/mocker
      // The actual function which calls these modules is not imported
      // and therefore we can externalize them.
      'msw/browser', 
      'msw/core/http',
    ], // Prefer `alias` over `external` because we're using aliases to bundle everything into the runtimes
    alias: {
      // The following aliases ensures that the runtimes bundles in the actual sources of these modules
      // instead of attempting to resolve them to the dist files, because the dist files are not available yet.
      'storybook/preview-api': './src/preview-api',
      'storybook/manager-api': './src/manager-api',
      'storybook/theming': './src/theming',
      'storybook/test': './src/test',
      'storybook/internal': './src',
      'storybook/outline': './src/outline',
      'storybook/backgrounds': './src/backgrounds',
      'storybook/highlight': './src/highlight',
      'storybook/measure': './src/measure',
      'storybook/actions': './src/actions',
      'storybook/viewport': './src/viewport',
      // The following aliases ensures that the manager has a single version of React,
      // even if transitive dependencies would depend on other versions.
      react: resolvePackageDir('react'),
      'react-dom': resolvePackageDir('react-dom'),
      'react-dom/client': join(resolvePackageDir('react-dom'), 'client'),
    },
    define: {
      // This should set react in prod mode for the manager
      'process.env.NODE_ENV': '"production"',
    },
  } as const satisfies EsbuildContextOptions;

  const contexts: Array<ReturnType<typeof esbuild.context>> = [];

  if (entries.node) {
    const uid = Math.random().toString(36).substring(2, 15);
    contexts.push(
      esbuild.context({
        ...sharedOptions,
        entryPoints: entries.node.map(({ entryPoint }) => entryPoint),
        platform: 'node',
        target: NODE_TARGET,
        chunkNames: '_node-chunks/[name]-[hash]',
        banner: {
          /*
          This banner injects CJS compatibility code into the bundle, for when
          dependencies need require, __filename, or __dirname.

          We're adding unique names to the imports to avoid collisions
          when one of our packages bundles in another of our packages,
          like create-storybook bundling in parts of storybook core.
          Similarly we're using var definitions as they can be redefined
          without causing errors.
          */
          js: dedent`
            import CJS_COMPAT_NODE_URL_${uid} from 'node:url';
            import CJS_COMPAT_NODE_PATH_${uid} from 'node:path';
            import CJS_COMPAT_NODE_MODULE_${uid} from "node:module";

            var __filename = CJS_COMPAT_NODE_URL_${uid}.fileURLToPath(import.meta.url);
            var __dirname = CJS_COMPAT_NODE_PATH_${uid}.dirname(__filename);
            var require = CJS_COMPAT_NODE_MODULE_${uid}.createRequire(import.meta.url);

            // ------------------------------------------------------------
            // end of CJS compatibility banner, injected by Storybook's esbuild configuration
            // ------------------------------------------------------------
            `,
        },
        plugins: [
          ...sharedOptions.plugins,
          metafileWriterPlugin('node', join(DIR_METAFILE_BASE, PACKAGE_DIR_NAME)),
        ],
      })
    );
  }

  if (entries.browser) {
    contexts.push(
      esbuild.context({
        ...sharedOptions,
        entryPoints: entries.browser.map(({ entryPoint }) => entryPoint),
        platform: 'browser',
        chunkNames: '_browser-chunks/[name]-[hash]',
        target: BROWSER_TARGETS,
        supported: SUPPORTED_FEATURES,
        plugins: [
          ...sharedOptions.plugins,
          metafileWriterPlugin('browser', join(DIR_METAFILE_BASE, PACKAGE_DIR_NAME)),
        ],
      })
    );
  }

  if (entries.runtime) {
    contexts.push(
      esbuild.context({
        ...runtimeOptions,
        entryPoints: entries.runtime.map(({ entryPoint }) => entryPoint),
        plugins: [
          ...runtimeOptions.plugins,
          metafileWriterPlugin('runtime', join(DIR_METAFILE_BASE, PACKAGE_DIR_NAME)),
        ],
      })
    );
  }

  if (entries.globalizedRuntime) {
    contexts.push(
      esbuild.context({
        ...runtimeOptions,
        entryPoints: entries.globalizedRuntime.map(({ entryPoint }) => entryPoint),
        plugins: [
          ...runtimeOptions.plugins,
          globalExternals(globalsModuleInfoMap),
          metafileWriterPlugin('globalizedRuntime', join(DIR_METAFILE_BASE, PACKAGE_DIR_NAME)),
        ],
      })
    );
  }

  const compile = await Promise.all(contexts);

  await Promise.all(
    compile.map(async (context) => {
      if (isWatch) {
        await context.watch();
        // show a log message when a file is compiled
        watch(join(DIR_CWD, 'dist'), { recursive: true }, (_event, filename) => {
          console.log(`compiled ${picocolors.cyan(join(DIR_REL, 'dist', filename))}`);
        });
      } else {
        await context.rebuild();
        await context.dispose();
      }
    })
  );
}
