/* eslint-disable local-rules/no-uncategorized-errors */
import { existsSync, watch } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import * as esbuild from 'esbuild';
import { join, relative } from 'pathe';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { globalsModuleInfoMap } from '../../../code/core/src/manager/globals/globals-module-info';
import {
  BROWSER_TARGETS,
  NODE_TARGET,
  SUPPORTED_FEATURES,
} from '../../../code/core/src/shared/constants/environments-support';
import { resolvePackageDir } from '../../../code/core/src/shared/utils/module';
import { type BuildEntries, type EsbuildContextOptions, getExternal } from './entry-utils';

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
const DIR_CODE = join(import.meta.dirname, '..', '..', '..', 'code');

export async function generateBundle({
  cwd,
  entry,
  isProduction,
  isWatch,
}: {
  cwd: string;
  entry: BuildEntries;
  isProduction: boolean;
  isWatch: boolean;
}) {
  const DIR_CWD = cwd;
  const DIR_REL = relative(DIR_CODE, DIR_CWD);
  const DIR_METAFILE = join(DIR_METAFILE_BASE, DIR_REL);
  const external = (await getExternal(DIR_CWD)).runtimeExternal;
  const { entries, postbuild } = entry;

  function defineESBuildContext(id: string, ...input: Parameters<typeof esbuild.context>) {
    const sharedOptions = {
      format: 'esm',
      bundle: true,
      legalComments: 'none',
      ignoreAnnotations: true,
      splitting: true,
      metafile: true,
      minifyIdentifiers: true,
      minifySyntax: isProduction,
      minifyWhitespace: false,
      keepNames: true, // required to show correct error messages based on class names
      outbase: 'src',
      outdir: 'dist',
      treeShaking: true,
      color: true,
      external,
    } as const satisfies EsbuildContextOptions;

    const [config, ...rest] = input;
    const cloned = { ...config };

    if (postbuild) {
      cloned.plugins = [
        ...(cloned.plugins ?? []),
        {
          name: 'postbuild',
          setup(build) {
            build.onEnd(async (result) => {
              if (result.errors.length) {
                return;
              }
              await postbuild(DIR_CWD);
            });
          },
        },
      ];
    }

    return [
      id,
      esbuild.context(
        {
          ...sharedOptions,
          ...config,
        },
        ...rest
      ),
    ] as const;
  }

  const runtimeOptions = {
    platform: 'browser',
    target: BROWSER_TARGETS,
    supported: SUPPORTED_FEATURES,
    splitting: false,
    external: [], // don't externalize anything, we're using aliases to bundle everything into the runtimes
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
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  } as const satisfies EsbuildContextOptions;

  const contexts = [
    entries.node &&
      defineESBuildContext('node', {
        entryPoints: entries.node.map(({ entryPoint }) => entryPoint),
        platform: 'node',
        target: NODE_TARGET,
        chunkNames: '_node-chunks/[name]-[hash]',
        banner: {
          js: dedent`
            import CJS_COMPAT_NODE_URL from 'node:url';
            import CJS_COMPAT_NODE_PATH from 'node:path';
            import CJS_COMPAT_NODE_MODULE from "node:module";

            const __filename = CJS_COMPAT_NODE_URL.fileURLToPath(import.meta.url);
            const __dirname = CJS_COMPAT_NODE_PATH.dirname(__filename);
            const require = CJS_COMPAT_NODE_MODULE.createRequire(import.meta.url);
            // ------------------------------------------------------------
            // end of CJS compatibility banner, injected by Storybook's esbuild configuration
            // ------------------------------------------------------------
            `,
        },
      }),
    entries.browser &&
      defineESBuildContext('browser', {
        entryPoints: entries.browser.map(({ entryPoint }) => entryPoint),
        platform: 'browser',
        chunkNames: '_browser-chunks/[name]-[hash]',
        target: BROWSER_TARGETS,
        supported: SUPPORTED_FEATURES,
      }),
    entries.runtime &&
      defineESBuildContext('runtime', {
        ...runtimeOptions,
        entryPoints: entries.runtime.map(({ entryPoint }) => entryPoint),
      }),
    entries.globalizedRuntime &&
      defineESBuildContext('globalized-runtime', {
        ...runtimeOptions,
        entryPoints: entries.globalizedRuntime.map(({ entryPoint }) => entryPoint),
        plugins: [globalExternals(globalsModuleInfoMap)],
      }),
  ].filter(Boolean);
  const compile = await Promise.all(contexts.map(([, context]) => context));

  if (isWatch) {
    await Promise.all(
      compile.map(async (context) => {
        await context.watch();
        await context.rebuild();
      })
    );

    // show a log message when a file is compiled
    watch(join(DIR_CWD, 'dist'), { recursive: true }, (_event, filename) => {
      console.log(`compiled ${picocolors.cyan(join(DIR_REL, 'dist', filename))}`);
    });
  } else {
    if (existsSync(DIR_METAFILE)) {
      await rm(DIR_METAFILE, { recursive: true, force: true });
    }
    await mkdir(DIR_METAFILE, { recursive: true });

    const mapIndexToName = contexts.map(([id]) => id);
    const outputs = await Promise.all(
      compile.map(async (context) => {
        const output = await context.rebuild();
        await context.dispose();
        return output;
      })
    );
    let index = 0;
    for (const currentOutput of outputs) {
      index++;
      if (!currentOutput.metafile) {
        return;
      }

      await writeFile(
        join(DIR_METAFILE, `${mapIndexToName[index - 1]}.json`),
        JSON.stringify(currentOutput.metafile, null, 2)
      );
    }
  }
}
