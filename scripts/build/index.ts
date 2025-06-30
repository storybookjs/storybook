/* eslint-disable local-rules/no-uncategorized-errors */
import { existsSync, watch } from 'node:fs';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import * as esbuild from 'esbuild';
import type { Metafile } from 'esbuild';
import { dirname, join } from 'pathe';
import picocolors from 'picocolors';
import prettyTime from 'pretty-hrtime';
import { dedent } from 'ts-dedent';

import { globalsModuleInfoMap } from '../../code/core/src/manager/globals/globals-module-info';
import {
  BROWSER_TARGETS,
  NODE_TARGET,
  SUPPORTED_FEATURES,
} from '../../code/core/src/shared/constants/environments-support';
import { resolveModule } from '../../code/core/src/shared/utils/module';
import { buildEntries } from './entries';
import { measure } from './utils';
import { generatePackageJsonFile } from './utils/generate-package-json';
import { generateTypesMapperFiles } from './utils/generate-type-mappers';
import { generateTypesFiles } from './utils/generate-types';
import { modifyCoreThemeTypes } from './utils/modify-core-theme-types';

async function run() {
  const flags = process.argv.slice(2);
  const cwd = process.cwd();

  const isProduction = flags.includes('--prod') || flags.includes('--production');
  const isWatch = flags.includes('--watch');

  if (isProduction && isWatch) {
    throw new Error('Cannot watch and build for production at the same time');
  }

  const { default: pkg } = await import(join(cwd, 'package.json'), { with: { type: 'json' } });

  await rm(join(cwd, 'dist'), { recursive: true }).catch(() => {});
  await mkdir(join(cwd, 'dist'));

  type EsbuildContextOptions = Parameters<(typeof esbuild)['context']>[0];

  console.log(isWatch ? `Watching ${pkg.name}...` : `Building ${pkg.name}...`);

  const { entries, prebuild, postbuild } = buildEntries[pkg.name];
  if (!entries) {
    throw new Error(`TODO BETTER ERROR: No build entries found for package ${pkg.name}`);
  }

  const dtsEntries = Object.values(entries)
    .flat()
    .filter((entry) => entry.dts !== false);

  if (prebuild) {
    console.log(`Running prebuild script for ${pkg.name}...`);
    const prebuildTime = await measure(() => prebuild(cwd));
    console.log(
      `Prebuild script for ${pkg.name} completed in`,
      picocolors.yellow(prettyTime(prebuildTime))
    );
  }

  await generatePackageJsonFile(cwd, entries);
  const dist = measure(generateDistFiles);
  const types = measure(async () => {
    await generateTypesMapperFiles(dtsEntries, cwd);
    await modifyCoreThemeTypes(cwd);
    if (isProduction) {
      await generateTypesFiles(dtsEntries, cwd);
    }
  });

  const [distTime, typesTime] = await Promise.all([dist, types]);

  console.log(
    isWatch ? 'Watcher started in' : 'Bundled in',
    picocolors.yellow(prettyTime(distTime))
  );
  console.log(
    isProduction ? 'Generated types in' : 'Generated type mappers in',
    picocolors.yellow(prettyTime(typesTime))
  );

  async function generateDistFiles() {
    const external = [
      'storybook',
      'react',
      'react-dom',
      'react-dom/client',
      ...Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) }),
    ];
    const noExternal = [
      '@testing-library/jest-dom',
      '@testing-library/user-event',
      'chai',
      '@vitest/expect',
      '@vitest/spy',
      '@vitest/utils',
    ];

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
      external: external.filter((external) => !noExternal.includes(external)),
    } as const satisfies EsbuildContextOptions;

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
        react: resolveModule({ pkg: 'react', customSuffix: '' }),
        'react-dom': resolveModule({ pkg: 'react-dom', customSuffix: '' }),
        'react-dom/client': resolveModule({ pkg: 'react-dom', customSuffix: 'client' }),
      },
      define: {
        // This should set react in prod mode for the manager
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
    } as const satisfies EsbuildContextOptions;

    function defineESBuildContext(...input: Parameters<typeof esbuild.context>) {
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
                console.log('postbuild', cwd);
                await postbuild(cwd);
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

    const compile = await Promise.all([
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
        // plugins: [
        //   {
        //     name: 'bin-executable-permissions',
        //     setup(build) {
        //       build.onEnd(async (result) => {
        //         if (result.errors.length) {
        //           return;
        //         }
        //         // Change permissions for the main bin to be executable
        //         const dispatcherPath = join(
        //           import.meta.dirname,
        //           '..',
        //           '..',
        //           'code',
        //           'core',
        //           'dist',
        //           'bin',
        //           'dispatcher.js'
        //         );
        //         await chmod(dispatcherPath, 0o755);
        //       });
        //     },
        //   },
        // ],
      }),
      defineESBuildContext({
        entryPoints: entries.browser.map(({ entryPoint }) => entryPoint),
        platform: 'browser',
        target: BROWSER_TARGETS,
        supported: SUPPORTED_FEATURES,
      }),
      defineESBuildContext({
        ...runtimeOptions,
        entryPoints: entries.runtime.map(({ entryPoint }) => entryPoint),
      }),
      defineESBuildContext({
        ...runtimeOptions,
        entryPoints: entries.globalizedRuntime.map(({ entryPoint }) => entryPoint),
        plugins: [globalExternals(globalsModuleInfoMap)],
      }),
    ]);

    if (isWatch) {
      await Promise.all(
        compile.map(async (context) => {
          await context.watch();
        })
      );

      // show a log message when a file is compiled
      watch(join(cwd, 'dist'), { recursive: true }, (_event, filename) => {
        console.log(`compiled ${picocolors.cyan(filename)}`);
      });
    } else {
      // repo root/bench/esbuild-metafiles/core
      const metafilesDir = join(
        import.meta.dirname,
        '..',
        '..',
        'bench',
        'esbuild-metafiles',
        'core'
      );
      if (existsSync(metafilesDir)) {
        await rm(metafilesDir, { recursive: true });
      }
      await mkdir(metafilesDir, { recursive: true });
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
          await writeFile(
            join(metafilesDir, `${sanitizedModuleName}.json`),
            JSON.stringify(metafile, null, 2)
          );
          await writeFile(
            join(metafilesDir, `${sanitizedModuleName}.txt`),
            await esbuild.analyzeMetafile(metafile, { color: false, verbose: false })
          );
        })
      );
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
