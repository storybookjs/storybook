/* eslint-disable local-rules/no-uncategorized-errors */
import { existsSync, watch } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import * as esbuild from 'esbuild';
import type { Metafile } from 'esbuild';
import { dirname, join, relative } from 'pathe';
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
import { writeOptimizedMetafile } from './optimize-esbuild-metafile';

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

export async function generateBundle(
  cwd: string,
  data: BuildEntries,
  isProduction: boolean,
  isWatch: boolean
) {
  const DIR_CWD = cwd;
  const DIR_REL = relative(DIR_CODE, DIR_CWD);
  const DIR_METAFILE = join(DIR_METAFILE_BASE, DIR_REL);
  const external = (await getExternal(DIR_CWD)).runtimeExternal;
  const { entries, postbuild } = data;

  const runtimeOptions = {
    platform: 'browser',
    target: BROWSER_TARGETS,
    supported: SUPPORTED_FEATURES,
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

  function defineESBuildContext(...input: Parameters<typeof esbuild.context>) {
    const sharedOptions = {
      format: 'esm',
      bundle: true,
      metafile: true,
      minifyIdentifiers: isProduction,
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

    return esbuild.context(
      {
        ...sharedOptions,
        ...config,
      },
      ...rest
    );
  }

  const compile = await Promise.all(
    [
      entries.node &&
        defineESBuildContext({
          entryPoints: entries.node.map(({ entryPoint }) => entryPoint),
          platform: 'node',
          target: NODE_TARGET,
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
        defineESBuildContext({
          entryPoints: entries.browser.map(({ entryPoint }) => entryPoint),
          platform: 'browser',
          target: BROWSER_TARGETS,
          supported: SUPPORTED_FEATURES,
        }),
      entries.runtime &&
        defineESBuildContext({
          ...runtimeOptions,
          entryPoints: entries.runtime.map(({ entryPoint }) => entryPoint),
        }),
      entries.globalizedRuntime &&
        defineESBuildContext({
          ...runtimeOptions,
          entryPoints: entries.globalizedRuntime.map(({ entryPoint }) => entryPoint),
          plugins: [globalExternals(globalsModuleInfoMap)],
        }),
    ].filter(Boolean)
  );

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
    if (!existsSync(DIR_METAFILE)) {
      await mkdir(DIR_METAFILE, { recursive: true });
    }
    const outputs = await Promise.all(
      compile.map(async (context) => {
        const output = await context.rebuild();
        await context.dispose();
        return output;
      })
    );
    const metafileByModule: Record<string, Metafile> = {};
    for (const currentOutput of outputs) {
      if (!currentOutput.metafile) {
        continue;
      }
      for (const key of Object.keys(currentOutput.metafile.outputs)) {
        const moduleName = dirname(key).replace('dist/', '');
        const existingMetafile = metafileByModule[moduleName];
        if (existingMetafile) {
          existingMetafile.inputs = {
            ...existingMetafile.inputs,
            ...currentOutput.metafile.inputs,
          };
          existingMetafile.outputs = {
            ...existingMetafile.outputs,
            [key]: currentOutput.metafile.outputs[key],
          };
        } else {
          metafileByModule[moduleName] = {
            ...currentOutput.metafile,
            outputs: { [key]: currentOutput.metafile.outputs[key] },
          };
        }
      }
    }
    await Promise.all(
      Object.entries(metafileByModule).map(async ([moduleName, metafile]) => {
        const sanitizedModuleName = moduleName.replaceAll('/', '-');
        await writeOptimizedMetafile(metafile, join(DIR_METAFILE, `${sanitizedModuleName}.json`));
      })
    );
  }
}
