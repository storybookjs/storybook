/* eslint-disable local-rules/no-uncategorized-errors */
import { existsSync, mkdirSync, watch } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Metafile } from 'esbuild';

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
import { globalsModuleInfoMap } from '../src/manager/globals-module-info';
import { getBundles, getEntries, getFinals } from './entries';
import { generatePackageJsonFile } from './helpers/generatePackageJsonFile';
import { generateTypesFiles } from './helpers/generateTypesFiles';
import { generateTypesMapperFiles } from './helpers/generateTypesMapperFiles';
import { isBrowser, isNode, noExternals } from './helpers/isEntryType';
import { modifyThemeTypes } from './helpers/modifyThemeTypes';
import { generateSourceFiles } from './helpers/sourcefiles';

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
  const bundles = getBundles(cwd);
  const finals = getFinals(cwd);

  type EsbuildContextOptions = Parameters<(typeof esbuild)['context']>[0];

  console.log(isWatch ? 'Watching...' : 'Bundling...');

  const files = measure(generateSourceFiles);
  const packageJson = measure(() => generatePackageJsonFile(entries));
  const dist = files.then(() => measure(generateDistFiles));
  const types = files.then(() =>
    measure(async () => {
      await generateTypesMapperFiles(entries);
      await modifyThemeTypes();
      await generateTypesFiles(entries, isOptimized, cwd);
      await modifyThemeTypes();
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
      external: ['@storybook/core', ...external],
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
    } satisfies EsbuildContextOptions;

    const browserEsbuildOptions = {
      ...esbuildDefaultOptions,
      format: 'esm',
      target: ['chrome100', 'safari15', 'firefox91'],
      splitting: false,
      platform: 'browser',

      conditions: ['browser', 'module', 'import', 'default'],
    } satisfies EsbuildContextOptions;

    const nodeEsbuildOptions = {
      ...esbuildDefaultOptions,
      target: 'node18',
      splitting: false,
      platform: 'neutral',
      mainFields: ['main', 'module', 'node'],
      conditions: ['node', 'module', 'import', 'require'],
    } satisfies EsbuildContextOptions;

    const browserAliases = {
      assert: require.resolve('browser-assert'),
      process: require.resolve('process/browser.js'),
      util: require.resolve('util/util.js'),
    };

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
          alias: browserAliases,
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
      ...bundles.flatMap((entry) => {
        const results = [];
        results.push(
          esbuild.context(
            merge<EsbuildContextOptions>(browserEsbuildOptions, {
              outdir: dirname(entry.file).replace('src', 'dist'),
              entryPoints: [entry.file],
              outExtension: { '.js': '.js' },
              alias: {
                ...browserAliases,
                '@storybook/core': join(cwd, 'src'),
                react: dirname(require.resolve('react/package.json')),
                'react-dom': dirname(require.resolve('react-dom/package.json')),
                'react-dom/client': join(
                  dirname(require.resolve('react-dom/package.json')),
                  'client'
                ),
              },
              define: {
                // This should set react in prod mode for the manager
                'process.env.NODE_ENV': JSON.stringify('production'),
              },
              external: [],
            })
          )
        );

        return results;
      }),
      ...finals.flatMap((entry) => {
        const results = [];
        results.push(
          esbuild.context(
            merge<EsbuildContextOptions>(browserEsbuildOptions, {
              alias: {
                '@storybook/core': join(cwd, 'src'),
                react: dirname(require.resolve('react/package.json')),
                'react-dom': dirname(require.resolve('react-dom/package.json')),
                'react-dom/client': join(
                  dirname(require.resolve('react-dom/package.json')),
                  'client'
                ),
              },
              define: {
                // This should set react in prod mode for the manager
                'process.env.NODE_ENV': JSON.stringify('production'),
              },
              entryPoints: [entry.file],
              external: [],
              outdir: dirname(entry.file).replace('src', 'dist'),
              outExtension: {
                '.js': '.js',
              },
              plugins: [globalExternals(globalsModuleInfoMap)],
            })
          )
        );

        return results;
      }),
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
                    ...esbuildDefaultOptions.external,
                    ...entry.externals,
                  ].filter((e) => !entry.internals.includes(e)),
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
                    ...esbuildDefaultOptions.external,
                    ...entry.externals,
                  ].filter((e) => !entry.internals.includes(e)),
                  outdir: dirname(entry.file).replace('src', 'dist'),
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
                    ...esbuildDefaultOptions.external,
                    ...entry.externals,
                  ].filter((e) => !entry.internals.includes(e)),
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
        compile.map(async (context) => {
          await context.watch();
        })
      );

      // show a log message when a file is compiled
      watch(join(cwd, 'dist'), { recursive: true }, (event, filename) => {
        console.log(`compiled ${picocolors.cyan(filename)}`);
      });
    } else {
      // repo root/bench/esbuild-metafiles/core
      const metafilesDir = join(__dirname, '..', '..', 'bench', 'esbuild-metafiles', 'core');
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

        const keys = Object.keys(currentOutput.metafile.outputs);
        const moduleName = keys.length === 1 ? dirname(keys[0]).replace('dist/', '') : 'core';

        const existingMetafile = metafileByModule[moduleName];

        if (existingMetafile) {
          existingMetafile.inputs = {
            ...existingMetafile.inputs,
            ...currentOutput.metafile.inputs,
          };
          existingMetafile.outputs = {
            ...existingMetafile.outputs,
            ...currentOutput.metafile.outputs,
          };
        } else {
          metafileByModule[moduleName] = currentOutput.metafile;
        }
      }

      await Promise.all(
        Object.entries(metafileByModule).map(async ([moduleName, metafile]) => {
          await writeFile(
            join(metafilesDir, `${moduleName}.json`),
            JSON.stringify(metafile, null, 2)
          );
          await writeFile(
            join(metafilesDir, `${moduleName}.txt`),
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
