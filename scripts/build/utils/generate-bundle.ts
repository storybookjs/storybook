/* eslint-disable local-rules/no-uncategorized-errors */
import { existsSync, watch } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';

import * as esbuild from 'esbuild';
import { basename, join, relative } from 'pathe';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';
import {raw as rawPlugin} from 'esbuild-raw-plugin';

import { globalsModuleInfoMap } from '../../../code/core/src/manager/globals/globals-module-info';
import {
  BROWSER_TARGETS,
  NODE_TARGET,
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
      rawPlugin(),
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
        plugins: [
          ...sharedOptions.plugins,
          metafileWriterPlugin('browser', join(DIR_METAFILE_BASE, PACKAGE_DIR_NAME)),
        ],
      })
    );
  }

  if (entries.runtime) {
    // Use rolldown for better code splitting with chunk size limits
    const { rolldown } = await import('rolldown');
    
    const buildRuntimeWithRolldown = async () => {
      const bundle = await rolldown({
        input: entries.runtime.map(({ entryPoint }) => entryPoint),
        cwd: DIR_CWD,
        platform: 'browser',
        resolve: {
          extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx'],
          conditionNames: ['browser', 'module', 'default'],
          alias: {
            'storybook/preview-api': join(DIR_CWD, './src/preview-api'),
            'storybook/manager-api': join(DIR_CWD, './src/manager-api'),
            'storybook/theming': join(DIR_CWD, './src/theming'),
            'storybook/test': join(DIR_CWD, './src/test'),
            'storybook/outline': join(DIR_CWD, './src/outline'),
            'storybook/backgrounds': join(DIR_CWD, './src/backgrounds'),
            'storybook/highlight': join(DIR_CWD, './src/highlight'),
            'storybook/measure': join(DIR_CWD, './src/measure'),
            'storybook/actions': join(DIR_CWD, './src/actions'),
            'storybook/viewport': join(DIR_CWD, './src/viewport'),
            react: resolvePackageDir('react'),
            'react-dom': resolvePackageDir('react-dom'),
            'react-dom/client': join(resolvePackageDir('react-dom'), 'client'),
          },
        },
        plugins: [
          {
            name: 'resolve-storybook-internal',
            async resolveId(source, importer, options) {
              if (source.startsWith('storybook/internal/')) {
                const relativePath = source.replace('storybook/internal/', '');
                // Transform import but let rolldown continue resolution with the file path
                return this.resolve(join(DIR_CWD, 'src', relativePath), importer, {
                  ...options,
                  skipSelf: true,
                });
              }
              return null;
            },
          },
          {
            name: 'globals-externals',
            renderChunk(code) {
              // Transform bare imports for externalized globals into global variable references
              let transformedCode = code;
              
              for (const [moduleId, moduleInfo] of Object.entries(globalsModuleInfoMap)) {
                const globalVar = moduleInfo.varName;
                const escapedModuleId = moduleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                // Transform mixed default + named imports: import DEFAULT, { named } from "module"
                const mixedDefaultNamedRegex = new RegExp(
                  `import\\s+([\\w$]+)\\s*,\\s*\\{([^}]+)\\}\\s*from\\s+['"]${escapedModuleId}['"];?`,
                  'g'
                );
                transformedCode = transformedCode.replace(mixedDefaultNamedRegex, (_match, defaultName, namedImports) => {
                  const statements = [`const ${defaultName} = globalThis.${globalVar};`];
                  const importPairs = namedImports.split(',').map((imp: string) => imp.trim());
                  importPairs.forEach((imp: string) => {
                    const parts = imp.split(/\s+as\s+/);
                    if (parts.length === 2) {
                      statements.push(`const ${parts[1].trim()} = globalThis.${globalVar}.${parts[0].trim()};`);
                    } else {
                      statements.push(`const ${imp} = globalThis.${globalVar}.${imp};`);
                    }
                  });
                  return statements.join('\n');
                });
                
                // Transform: import * as NAME from "module-id"
                transformedCode = transformedCode.replace(
                  new RegExp(`import \\* as ([\\w$]+) from ['"]${escapedModuleId}['"];?\\n?`, 'g'),
                  `const $1 = globalThis.${globalVar};\n`
                );
                
                // Transform: import DEFAULT from "module-id"  
                transformedCode = transformedCode.replace(
                  new RegExp(`import ([\\w$]+) from ['"]${escapedModuleId}['"];?\\n?`, 'g'),
                  `const $1 = globalThis.${globalVar};\n`
                );
                
                // Transform: import { ... } from "module-id"
                transformedCode = transformedCode.replace(
                  new RegExp(`import \\{([^}]+)\\} from ['"]${escapedModuleId}['"];?\\n?`, 'g'),
                  (_, imports) => {
                    const importParts = imports.split(',').map((imp: string) => imp.trim());
                    return importParts.map((imp: string) => {
                      const parts = imp.split(/\s+as\s+/);
                      const imported = parts[0].trim();
                      const local = parts[1]?.trim() || imported;
                      return `const ${local} = globalThis.${globalVar}.${imported};`;
                    }).join('\n') + '\n';
                  }
                );

                // Transform CJS __require("module-id") calls → globalThis.VAR
                transformedCode = transformedCode.replace(
                  new RegExp(`__require\\(['"]${escapedModuleId}['"]\\)`, 'g'),
                  `globalThis.${globalVar}`
                );
              }
              
              return { code: transformedCode, map: null };
            },
          },
        ],
        external: (id) => {
          // Only externalize specific msw modules
          if (id === 'msw/browser' || id === 'msw/core/http') {
            return true;
          }
          // Bundle everything else
          return false;
        },
        treeshake: {
          annotations: false,
        },
        transform: {
          target: BROWSER_TARGETS,
          jsx: {
            runtime: 'classic',
            pragma: 'React.createElement',
            pragmaFrag: 'React.Fragment',
          },
          define: {
            'process.env.NODE_ENV': '"production"',
          },
        },
      });

      try {
        const result = await bundle.generate({
          format: 'esm',
          dir: 'dist',
          entryFileNames: (chunkInfo) => {
            // Use facadeModuleId to determine the correct output path
            const facadeId = chunkInfo.facadeModuleId || '';
            if (facadeId.includes('src/preview/runtime')) return 'preview/runtime.js';
            if (facadeId.includes('src/manager/globals-runtime')) return 'manager/globals-runtime.js';
            if (facadeId.includes('src/mocking-utils/mocker-runtime')) return 'mocking-utils/mocker-runtime.js';
            // Fallback for other entries
            return '[name].js';
          },
          chunkFileNames: 'manager/_manager-chunks/[name]-[hash].js',
          sourcemap: false,
          minify: false,
          codeSplitting: {
            maxSize: 1024 * 1024, // 1MB max chunk size
            groups: [
              {
                name: 'react',
                test: /[\\/]node_modules[\\/]react(-dom)?[\\/]/,
                minSize: 100 * 1024, // 100KB min size
              },
              {
                name: 'icons',
                test: /[\\/]@storybook[\\/]icons[\\/]/,
                minSize: 50 * 1024, // 50KB min size
              },
            ],
          },
        });

        // Write output files
        for (const outputFile of result.output) {
          const filePath = join(DIR_CWD, 'dist', outputFile.fileName);
          // Ensure directory exists
          const dir = join(DIR_CWD, 'dist', outputFile.fileName.split('/').slice(0, -1).join('/'));
          await mkdir(dir, { recursive: true });
          const content = outputFile.type === 'chunk' ? outputFile.code : outputFile.source;
          await writeFile(filePath, content);
        }

        // Write metafile if needed
        const metafilePath = join(DIR_METAFILE_BASE, PACKAGE_DIR_NAME, 'runtime.json');
        await mkdir(join(DIR_METAFILE_BASE, PACKAGE_DIR_NAME), { recursive: true });
        await writeFile(metafilePath, JSON.stringify({ outputs: result.output.map(o => ({
          fileName: o.fileName,
          size: o.type === 'chunk' ? o.code.length : o.source.length,
        })) }, null, 2));

        return result;
      } finally {
        await bundle.close();
      }
    };

    if (isWatch) {
      // For watch mode, rebuild on change
      watch(join(DIR_CWD, 'src'), { recursive: true }, async () => {
        try {
          await buildRuntimeWithRolldown();
          console.log(picocolors.cyan('Rebuilt runtime'));
        } catch (error) {
          console.error('Error rebuilding runtime:', error);
        }
      });
    }
    
    await buildRuntimeWithRolldown();
  }

  if (entries.globalizedRuntime) {
    // Use rolldown for better code splitting with chunk size limits
    const { rolldown } = await import('rolldown');
    
    const buildGlobalizedRuntimeWithRolldown = async () => {
      const bundle = await rolldown({
        input: entries.globalizedRuntime.map(({ entryPoint }) => entryPoint),
        cwd: DIR_CWD,
        platform: 'browser',
        resolve: {
          extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx'],
          conditionNames: ['browser', 'module', 'default'],
          alias: {
            'storybook/preview-api': join(DIR_CWD, './src/preview-api'),
            'storybook/manager-api': join(DIR_CWD, './src/manager-api'),
            'storybook/theming': join(DIR_CWD, './src/theming'),
            'storybook/test': join(DIR_CWD, './src/test'),
            'storybook/outline': join(DIR_CWD, './src/outline'),
            'storybook/backgrounds': join(DIR_CWD, './src/backgrounds'),
            'storybook/highlight': join(DIR_CWD, './src/highlight'),
            'storybook/measure': join(DIR_CWD, './src/measure'),
            'storybook/actions': join(DIR_CWD, './src/actions'),
            'storybook/viewport': join(DIR_CWD, './src/viewport'),
            react: resolvePackageDir('react'),
            'react-dom': resolvePackageDir('react-dom'),
            'react-dom/client': join(resolvePackageDir('react-dom'), 'client'),
          },
        },
        plugins: [
          {
            name: 'resolve-storybook-internal',
            async resolveId(source, importer, options) {
              if (source.startsWith('storybook/internal/')) {
                const relativePath = source.replace('storybook/internal/', '');
                // Transform import but let rolldown continue resolution with the file path
                return this.resolve(join(DIR_CWD, 'src', relativePath), importer, {
                  ...options,
                  skipSelf: true,
                });
              }
              return null;
            },
          },
          {
            name: 'globals-externals',
            renderChunk(code: string, _chunk: { fileName: string }) {
              // Transform remaining bare imports of externalized modules to globalThis references
              let transformedCode = code;
              
              for (const [moduleId, info] of Object.entries(globalsModuleInfoMap)) {
                const escapedModuleId = moduleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                
                // Transform mixed default + named imports: import DEFAULT, { named } from "module"
                const mixedDefaultNamedRegex = new RegExp(
                  `import\\s+([\\w$]+)\\s*,\\s*\\{([^}]+)\\}\\s*from\\s+['"]${escapedModuleId}['"];?`,
                  'g'
                );
                transformedCode = transformedCode.replace(mixedDefaultNamedRegex, (_match, defaultName, namedImports) => {
                  const statements = [`const ${defaultName} = globalThis.${info.varName};`];
                  const importPairs = namedImports.split(',').map((imp: string) => imp.trim());
                  importPairs.forEach((imp: string) => {
                    const parts = imp.split(/\s+as\s+/);
                    if (parts.length === 2) {
                      statements.push(`const ${parts[1].trim()} = globalThis.${info.varName}.${parts[0].trim()};`);
                    } else {
                      statements.push(`const ${imp} = globalThis.${info.varName}.${imp};`);
                    }
                  });
                  return statements.join('\n');
                });
                
                // Transform namespace imports: import * as NAME from "module" → const NAME = globalThis.__GLOBAL__;
                const namespaceRegex = new RegExp(
                  `import\\s*\\*\\s*as\\s+([\\w$]+)\\s+from\\s+['"]${escapedModuleId}['"];?`,
                  'g'
                );
                transformedCode = transformedCode.replace(namespaceRegex, (_match, name) => {
                  return `const ${name} = globalThis.${info.varName};`;
                });
                
                // Transform default imports: import DEFAULT from "module" → const DEFAULT = globalThis.__GLOBAL__;
                const defaultRegex = new RegExp(
                  `import\\s+([\\w$]+)\\s+from\\s+['"]${escapedModuleId}['"];?`,
                  'g'
                );
                transformedCode = transformedCode.replace(defaultRegex, (_match, name) => {
                  return `const ${name} = globalThis.${info.varName};`;
                });
                
                // Transform named imports: import { a, b as c } from "module" → const a = globalThis.__GLOBAL__.a; const c = globalThis.__GLOBAL__.b;
                const namedRegex = new RegExp(
                  `import\\s*\\{([^}]+)\\}\\s*from\\s+['"]${escapedModuleId}['"];?`,
                  'g'
                );
                transformedCode = transformedCode.replace(namedRegex, (_match, imports) => {
                  const importPairs = imports.split(',').map((imp: string) => imp.trim());
                  const statements = importPairs.map((imp: string) => {
                    const parts = imp.split(/\s+as\s+/);
                    if (parts.length === 2) {
                      // import { original as alias }
                      return `const ${parts[1].trim()} = globalThis.${info.varName}.${parts[0].trim()};`;
                    } else {
                      // import { name }
                      return `const ${imp} = globalThis.${info.varName}.${imp};`;
                    }
                  });
                  return statements.join('\n');
                });

                // Transform CJS __require("module-id") calls → globalThis.VAR
                transformedCode = transformedCode.replace(
                  new RegExp(`__require\\(['"]${escapedModuleId}['"]\\)`, 'g'),
                  `globalThis.${info.varName}`
                );
              }
              
              return { code: transformedCode };
            },
          },
        ],
        external: (id) => {
          // Externalize global packages that will be provided by globals-runtime.js
          if (id in globalsModuleInfoMap) {
            return true;
          }
          // Bundle everything else
          return false;
        },
        treeshake: {
          annotations: false,
        },
        transform: {
          target: BROWSER_TARGETS,
          jsx: {
            runtime: 'classic',
            pragma: 'React.createElement',
            pragmaFrag: 'React.Fragment',
          },
          define: {
            'process.env.NODE_ENV': '"production"',
          },
        },
      });

      try {
        const result = await bundle.generate({
          format: 'esm',
          dir: 'dist',
          entryFileNames: 'manager/[name].js',
          chunkFileNames: 'manager/_manager-chunks/[name]-[hash].js',
          sourcemap: false,
          minify: false,
          codeSplitting: {
            maxSize: 1024 * 1024, // 1MB max chunk size
          },
          globals: Object.fromEntries(
            Object.entries(globalsModuleInfoMap).map(([key, value]) => [key, value.varName])
          ),
        });

        // Write output files
        for (const outputFile of result.output) {
          const filePath = join(DIR_CWD, 'dist', outputFile.fileName);
          // Ensure directory exists
          const dir = join(DIR_CWD, 'dist', outputFile.fileName.split('/').slice(0, -1).join('/'));
          await mkdir(dir, { recursive: true });
          const content = outputFile.type === 'chunk' ? outputFile.code : outputFile.source;
          await writeFile(filePath, content);
        }

        // Write metafile if needed
        const metafilePath = join(DIR_METAFILE_BASE, PACKAGE_DIR_NAME, 'globalizedRuntime.json');
        await mkdir(join(DIR_METAFILE_BASE, PACKAGE_DIR_NAME), { recursive: true });
        await writeFile(metafilePath, JSON.stringify({ outputs: result.output.map(o => ({
          fileName: o.fileName,
          size: o.type === 'chunk' ? o.code.length : o.source.length,
        })) }, null, 2));

        return result;
      } finally {
        await bundle.close();
      }
    };

    if (isWatch) {
      // For watch mode, rebuild on change
      watch(join(DIR_CWD, 'src'), { recursive: true }, async () => {
        try {
          await buildGlobalizedRuntimeWithRolldown();
          console.log(picocolors.cyan('Rebuilt globalizedRuntime'));
        } catch (error) {
          console.error('Error rebuilding globalizedRuntime:', error);
        }
      });
    }
    
    await buildGlobalizedRuntimeWithRolldown();
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
