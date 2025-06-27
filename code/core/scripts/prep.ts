/* eslint-disable local-rules/no-uncategorized-errors */
import { existsSync, watch } from 'node:fs';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { commonjs } from '@hyrious/esbuild-plugin-commonjs';
import type { Metafile } from 'esbuild';
import drop from 'esbuild-plugin-drop';
import ignore from 'esbuild-plugin-ignore';
import { dirname, join } from 'pathe';

import {
  dedent,
  esbuild,
  globalExternals,
  measure,
  merge,
  nodeInternals,
  picocolors,
  prettyTime,
  process,
} from '../../../scripts/prepare/tools';
import pkg from '../package.json';
import { globalsModuleInfoMap } from '../src/manager/globals/globals-module-info';
import {
  BROWSER_TARGETS,
  NODE_TARGET,
  SUPPORTED_FEATURES,
} from '../src/shared/constants/environments-support';
import { resolveModule } from '../src/shared/utils/module';
import { esmOnlyDtsEntries, esmOnlyEntries, getEntries } from './entries';
import { generatePackageJsonFile } from './helpers/generatePackageJsonFile';
import { generateTypesFiles } from './helpers/generateTypesFiles';
import { generateTypesMapperFiles } from './helpers/generateTypesMapperFiles';
import { isBrowser, isNode, noExternals } from './helpers/isEntryType';
import { modifyThemeTypes } from './helpers/modifyThemeTypes';
import { generateSourceFiles } from './helpers/sourcefiles';
import { externalPlugin } from './no-externals-plugin';

async function run() {
  const flags = process.argv.slice(2);
  const cwd = process.cwd();

  const isOptimized = flags.includes('--optimized');
  const isWatch = flags.includes('--watch');
  const isReset = flags.includes('--reset');

  const external = [
    ...new Set([
      ...Object.keys(pkg.dependencies),
      ...Object.keys((pkg as any).peerDependencies || {}),
    ]),
  ];

  if (isOptimized && isWatch) {
    throw new Error('Cannot watch and optimize at the same time');
  }

  if (isReset) {
    await rm(join(cwd, 'dist'), { recursive: true }).catch(() => {});
    await mkdir(join(cwd, 'dist'));
  }

  const entries = getEntries(cwd);

  type EsbuildContextOptions = Parameters<(typeof esbuild)['context']>[0];

  console.log(isWatch ? 'Watching...' : 'Bundling...');

  const files = measure(generateSourceFiles);
  const packageJson = measure(() => generatePackageJsonFile(entries, esmOnlyEntries));
  const dist = files.then(() => measure(generateDistFiles));
  const types = files.then(() =>
    measure(async () => {
      await generateTypesMapperFiles(entries, esmOnlyDtsEntries);
      await modifyThemeTypes();
      await generateTypesFiles(entries, esmOnlyDtsEntries, isOptimized, cwd);
    })
  );

  const [filesTime, packageJsonTime, distTime, typesTime] = await Promise.all([
    files,
    packageJson,
    dist,
    types,
  ]);

  console.log('Files generated in', picocolors.yellow(prettyTime(filesTime)));
  console.log('Package.json generated in', picocolors.yellow(prettyTime(packageJsonTime)));
  console.log(
    isWatch ? 'Watcher started in' : 'Bundled in',
    picocolors.yellow(prettyTime(distTime))
  );
  console.log(
    isOptimized ? 'Generated types in' : 'Generated type mappers in',
    picocolors.yellow(prettyTime(typesTime))
  );

  async function generateDistFiles() {
    const esbuildDefaultOptions = {
      absWorkingDir: cwd,
      allowOverwrite: false,
      assetNames: 'assets/[name]-[hash]',
      bundle: true,
      chunkNames: 'chunks/[name]-[hash]',
      external: ['storybook', ...external],
      keepNames: true,
      legalComments: 'none',
      lineLimit: 140,
      metafile: true,
      minifyIdentifiers: isOptimized,
      minifySyntax: isOptimized,
      minifyWhitespace: false,
      outdir: 'dist',
      sourcemap: false,
      treeShaking: true,
      supported: {
        // This is an ES2018 feature, but esbuild is really strict here.
        // Since not all browser support the latest Unicode characters.
        //
        // Also this feature only works in combination with a Regex polyfill that we don't load.
        //
        // The Hermes engine of React Native doesn't support this feature,
        // but leaving the regex alone, actually allows Hermes to do its own thing,
        // without us having to load a RegExp polyfill.
        'regexp-unicode-property-escapes': true,
      },
    } satisfies EsbuildContextOptions;

    const browserEsbuildOptions = {
      ...esbuildDefaultOptions,
      format: 'esm',
      target: BROWSER_TARGETS,
      supported: SUPPORTED_FEATURES,
      splitting: false,
      platform: 'browser',

      conditions: ['browser', 'module', 'import', 'default'],
    } satisfies EsbuildContextOptions;

    const nodeEsbuildOptions = {
      ...esbuildDefaultOptions,
      target: NODE_TARGET,
      splitting: false,
      platform: 'neutral',
      mainFields: ['main', 'module', 'node'],
      conditions: ['node', 'module', 'import', 'require'],
    } satisfies EsbuildContextOptions;

    const esmOnlyExternal = [
      'storybook',
      'react',
      'react-dom',
      'react-dom/client',
      ...Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) }),
    ];
    const esmOnlyNoExternal = [
      '@testing-library/jest-dom',
      '@testing-library/user-event',
      'chai',
      '@vitest/expect',
      '@vitest/spy',
      '@vitest/utils',
    ];

    const esmOnlySharedOptions = {
      format: 'esm',
      bundle: true,
      metafile: true,
      minifyIdentifiers: isOptimized,
      minifySyntax: isOptimized,
      minifyWhitespace: false,
      keepNames: true, // required to show correct error messages based on class names
      outbase: 'src',
      outdir: 'dist',
      treeShaking: true,
      legalComments: 'none',
      color: true,
      external: esmOnlyExternal.filter((external) => !esmOnlyNoExternal.includes(external)),
    } as const satisfies EsbuildContextOptions;

    const esmOnlyRuntimeOptions = {
      ...esmOnlySharedOptions,
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

    // TODO: this will be the only compile to do once we've migrated all entry points over
    const esmOnlyCompile = await Promise.all([
      esbuild.context({
        ...esmOnlySharedOptions,
        entryPoints: esmOnlyEntries.node.map(({ entryPoint }) => entryPoint),
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

        plugins: [
          ignore([
            {
              resourceRegExp: /browserslist$/,
              contextRegExp: /node_modules\//,
            },
            // {
            //   resourceRegExp: /debug$/,
            //   contextRegExp: /node_modules\//,
            // },
          ]),
          // drop({ modules: ['node_modules/debug', 'debug'] }),
          commonjs({
            include: ({ path }) => {
              return (
                // path.includes('node_modules/debug') ||
                path.includes('node_modules/supports-color') ||
                path.includes('node_modules/@babel/helper-module-imports') ||
                path.includes('node_modules/@babel/core/lib') ||
                path.includes('node_modules/@babel/helper-compilation-targets') ||
                path.includes('node_modules/@babel/helper-module-transforms') ||
                path.includes('node_modules/@babel/helper-create-class-features-plugin') ||
                path.includes('node_modules/@babel/plugin-transform-typescript') ||
                path.includes('node_modules/browserslist') ||
                path.includes('node_modules/tsconfig-paths') ||
                path.includes('node_modules/fill-range') ||
                path.includes('node_modules/picomatch') ||
                path.includes('node_modules/micromatch') ||
                path.includes('node_modules/merge2') ||
                path.includes('node_modules/@nodelib/') ||
                path.includes('node_modules/graceful-fs') ||
                path.includes('node_modules/watchpack') ||
                path.includes('node_modules/fast-glob') ||
                path.includes('node_modules/totalist/sync/index.js') ||
                path.includes('node_modules/@polka/url') ||
                path.includes('node_modules/sirv') ||
                path.includes('node_modules/prompts') ||
                path.includes('node_modules/untildify') ||
                // path.includes('node_modules/debug') ||
                path.includes('node_modules/is-docker') ||
                path.includes('node_modules/open') ||
                path.includes('node_modules/address') ||
                // path.includes('node_modules/detect-port') ||
                // path.includes('node_modules/@colors/colors') ||
                // path.includes('node_modules/@aw-web-design/x-default-browser') ||
                path.includes('node_modules/@discoveryjs/json-ext') ||
                false
              );
            },
            requireReturnsDefault: (p) =>
              //
              p.includes('node_modules/mrmime') ||
              //
              // p.includes('node_modules/debug') ||
              false,
            transform: true,
          }),
          {
            name: 'bin-executable-permissions',
            setup(build) {
              build.onEnd(async (result) => {
                if (result.errors.length) {
                  return;
                }
                // Change permissions for the main bin to be executable
                const dispatcherPath = import.meta.resolve('storybook/internal/bin/dispatcher');
                await chmod(fileURLToPath(dispatcherPath), 0o755);
              });
            },
          },
        ],
      }),
      esbuild.context({
        ...esmOnlySharedOptions,
        entryPoints: esmOnlyEntries.browser.map(({ entryPoint }) => entryPoint),
        platform: 'browser',
        target: BROWSER_TARGETS,
        supported: SUPPORTED_FEATURES,
      }),
      esbuild.context({
        ...esmOnlyRuntimeOptions,
        entryPoints: esmOnlyEntries.runtime.map(({ entryPoint }) => entryPoint),
      }),
      esbuild.context({
        ...esmOnlyRuntimeOptions,
        entryPoints: esmOnlyEntries.globalizedRuntime.map(({ entryPoint }) => entryPoint),
        plugins: [globalExternals(globalsModuleInfoMap)],
      }),
    ]);

    const compile = await Promise.all([
      esbuild.context(
        merge<EsbuildContextOptions>(nodeEsbuildOptions, {
          entryPoints: entries
            .filter(isNode)
            .filter(noExternals)
            .map((e) => e.file),
          external: [...nodeInternals, ...esbuildDefaultOptions.external],
          format: 'cjs',
          outExtension: {
            '.js': '.cjs',
          },
        })
      ),
      esbuild.context(
        merge<EsbuildContextOptions>(browserEsbuildOptions, {
          entryPoints: entries
            .filter(isBrowser)
            .filter(noExternals)
            .map((entry) => entry.file),
          outExtension: {
            '.js': '.js',
          },
        })
      ),
      esbuild.context(
        merge<EsbuildContextOptions>(nodeEsbuildOptions, {
          banner: {
            js: dedent`
            import ESM_COMPAT_Module from "node:module";
            import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
            import { dirname as ESM_COMPAT_dirname } from 'node:path';
            const __filename = ESM_COMPAT_fileURLToPath(import.meta.url);
            const __dirname = ESM_COMPAT_dirname(__filename);
            const require = ESM_COMPAT_Module.createRequire(import.meta.url);
          `,
          },
          entryPoints: entries
            .filter(isNode)
            .filter(noExternals)
            .filter((i) => !isBrowser(i))
            .map((entry) => entry.file),
          external: [...nodeInternals, ...esbuildDefaultOptions.external],
          format: 'esm',
          outExtension: {
            '.js': '.js',
          },
        })
      ),
      ...entries
        .filter((entry) => !noExternals(entry))
        .flatMap((entry) => {
          const results = [];
          if (entry.node) {
            results.push(
              esbuild.context(
                merge<EsbuildContextOptions>(nodeEsbuildOptions, {
                  entryPoints: [entry.file],
                  external: [
                    ...nodeInternals,
                    ...esbuildDefaultOptions.external.filter((e) => !entry.noExternal.includes(e)),
                    ...entry.externals,
                  ].filter((e) => !entry.internals.includes(e)),
                  plugins: [
                    externalPlugin({
                      noExternal: entry.noExternal,
                    }),
                  ],
                  format: 'cjs',
                  outdir: dirname(entry.file).replace('src', 'dist'),
                  outExtension: {
                    '.js': '.cjs',
                  },
                })
              )
            );
          }
          if (entry.browser) {
            results.push(
              esbuild.context(
                merge<EsbuildContextOptions>(browserEsbuildOptions, {
                  entryPoints: [entry.file],
                  external: [
                    ...nodeInternals,
                    ...esbuildDefaultOptions.external.filter((e) => !entry.noExternal.includes(e)),
                    ...entry.externals,
                  ].filter((e) => !entry.internals.includes(e)),
                  outdir: dirname(entry.file).replace('src', 'dist'),
                  plugins: [
                    externalPlugin({
                      noExternal: entry.noExternal,
                    }),
                  ],
                  outExtension: {
                    '.js': '.js',
                  },
                })
              )
            );
          } else if (entry.node) {
            results.push(
              esbuild.context(
                merge<EsbuildContextOptions>(nodeEsbuildOptions, {
                  entryPoints: [entry.file],
                  external: [
                    ...nodeInternals,
                    ...esbuildDefaultOptions.external.filter((e) => !entry.noExternal.includes(e)),
                    ...entry.externals,
                  ].filter((e) => !entry.internals.includes(e)),
                  plugins: [
                    externalPlugin({
                      noExternal: entry.noExternal,
                    }),
                  ],
                  format: 'esm',
                  outdir: dirname(entry.file).replace('src', 'dist'),
                  outExtension: {
                    '.js': '.js',
                  },
                })
              )
            );
          }

          return results;
        }),
    ]);

    if (isWatch) {
      await Promise.all(
        compile.concat(esmOnlyCompile).map(async (context) => {
          await context.watch();
        })
      );

      // show a log message when a file is compiled
      watch(join(cwd, 'dist'), { recursive: true }, (event, filename) => {
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
        compile.concat(esmOnlyCompile).map(async (context) => {
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
