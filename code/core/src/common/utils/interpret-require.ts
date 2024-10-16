import { readFile } from 'node:fs/promises';
import { builtinModules, createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { findUp } from 'find-up';
import resolveFrom from 'resolve-from';
import { dedent } from 'ts-dedent';
import type { PackageJson } from 'type-fest';

import {
  dependencies as coreDependencies,
  peerDependencies as corePeerDependencies,
} from '../../../package.json';
import { getInterpretedFileWithExt } from './interpret-files';

let registered = false;

const requireFromCWD = createRequire(pathToFileURL(process.cwd()));

const defaultCacheMap = new Map<string, string>();

function unwrapModule<T>(result: any): T {
  return typeof result === 'object' && result !== null && typeof result.default !== 'undefined'
    ? result.default
    : result;
}

/**
 * @version experimental
 * @since 9.0.0
 * @param inputPath - The path to the file to import
 * @param options - Options to configure the import
 * @param options.cache - A cache to store the imported modules
 * @param options.cwd - The current working directory
 * @param options.out - The directory to store the bundled files
 * @returns The imported module. When the module has a default export, the default export will be
 *   returned
 * @summery Import a file in Node
 *
 * @variation local
 * When the file is local, it will be bundled with esbuild, then loaded and returned.
 * This is to support TS files and ESM modules
 *
 * @variation node_module
 * When the file is detected to be a node_module, it will be imported directly.
 * THIS DETECTION NEEDS TWEAKING
 */
export async function interopImport<T>(
  inputPath: string,
  { cache = defaultCacheMap, cwd = process.cwd() } = {}
): Promise<T> {
  // TODO: this is a heuristic, we should find a better way
  // console.log({ inputPath });

  let resolved = inputPath;
  if (!isAbsolute(inputPath)) {
    // console.log('not absolute');
    resolved = '';

    if (resolved === '') {
      try {
        resolved = fileURLToPath(import.meta.resolve(inputPath));
      } catch (e) {}
    }

    if (resolved === '') {
      try {
        resolved = requireFromCWD.resolve(inputPath);
      } catch (e) {}
    }

    if (resolved === '') {
      try {
        resolved = resolveFrom(process.cwd(), inputPath);
      } catch (e) {}
    }
  }
  // console.log({ resolved });

  if (resolved.includes('node_modules')) {
    const result = unwrapModule(await import(resolved));
    // console.log({ result });
    return result;
  }

  // console.log(`bundling ${inputPath}!!!`);

  const cached = cache.get(inputPath);

  if (!!cached) {
    return unwrapModule(await import(cached));
  }

  const targetDirectory = dirname(inputPath);

  const [{ build }, { dependencies, devDependencies, peerDependencies }] = await Promise.all([
    import('esbuild'),
    findUp('package.json', { cwd: targetDirectory }).then(
      async (a) => (a ? JSON.parse(await readFile(a, { encoding: 'utf-8' })) : {}) as PackageJson
    ),
  ]);

  const outPath = join(targetDirectory, `${basename(inputPath)}.${cache.size.toString()}.mjs`);

  cache.set(inputPath, outPath);

  const external = [
    ...builtinModules.flatMap((m) => [m, `node:${m}`]),
    'fsevents',
    'storybook',
    '@storybook/core',
    ...Object.keys(dependencies || {}),
    ...Object.keys(devDependencies || {}),
    ...Object.keys(peerDependencies || {}),
    ...Object.keys(coreDependencies || {}),
    ...Object.keys(corePeerDependencies || {}),
  ];

  const dirnameVarName = '__sb_injected_original_dirname';
  const filenameVarName = '__sb_injected_original_filename';
  const importMetaUrlVarName = '__sb_injected_original_import_meta_url';

  // console.log('NICE');

  await build({
    entryPoints: [inputPath],
    bundle: true,
    write: true,
    lineLimit: 140,

    splitting: false,
    platform: 'neutral',
    mainFields: ['main', 'module', 'node'],
    conditions: ['node', 'module', 'import', 'require'],

    format: 'esm',
    target: `node${process.version.slice(1)}`,
    logLevel: 'silent',
    define: {
      __dirname: dirnameVarName,
      __filename: filenameVarName,
      'import.meta.url': importMetaUrlVarName,
      'import.meta.dirname': dirnameVarName,
      'import.meta.filename': filenameVarName,
    },
    banner: {
      js: dedent`
        /* experimental interopImport generated */
        /* from ${inputPath} */
        /* to ${outPath} */

        import ESM_COMPAT_Module from "node:module";
        const require = ESM_COMPAT_Module.createRequire(import.meta.url);
      `,
    },
    plugins: [
      {
        name: 'inject-file-scope-variables',
        setup(b) {
          b.onLoad({ filter: /\.[cm]?[jt]s$/ }, async (args) => {
            const contents = await readFile(args.path, 'utf-8');
            const injectValues =
              `const ${dirnameVarName} = ${JSON.stringify(dirname(args.path))};` +
              `const ${filenameVarName} = ${JSON.stringify(args.path)};` +
              `const ${importMetaUrlVarName} = ${JSON.stringify(pathToFileURL(args.path).href)};`;

            return {
              loader: args.path.endsWith('ts') ? 'ts' : 'js',
              contents: injectValues + contents.replace('', ''),
            };
          });
        },
      },
    ],

    treeShaking: true,
    outfile: outPath,
    absWorkingDir: cwd,
    sourcemap: true,
    external,
    allowOverwrite: true,
  });

  return unwrapModule(await import(outPath));
}

export function interopRequireDefault(filePath: string) {
  // eslint-disable-next-line no-underscore-dangle
  const hasEsbuildBeenRegistered = !!require('module')._extensions['.ts'];

  if (registered === false && !hasEsbuildBeenRegistered) {
    const { register } = require('esbuild-register/dist/node');
    registered = true;
    register({
      target: `node${process.version.slice(1)}`,
      format: 'cjs',
      hookIgnoreNodeModules: true,
      // Some frameworks, like Stylus, rely on the 'name' property of classes or functions
      // https://github.com/storybookjs/storybook/issues/19049
      keepNames: true,
      tsconfigRaw: `{
      "compilerOptions": {
        "strict": false,
        "skipLibCheck": true,
      },
    }`,
    });
  }

  const result = require(filePath);

  const isES6DefaultExported =
    typeof result === 'object' && result !== null && typeof result.default !== 'undefined';

  return isES6DefaultExported ? result.default : result;
}

function getCandidate(paths: string[]) {
  for (let i = 0; i < paths.length; i += 1) {
    const candidate = getInterpretedFileWithExt(paths[i]);

    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

export function serverRequire(filePath: string | string[]) {
  const candidatePath = serverResolve(filePath);

  console.error(`serverRequire called from ${filePath}`);

  if (!candidatePath) {
    return null;
  }

  return interopRequireDefault(candidatePath);
}

export function serverResolve(filePath: string | string[]): string | null {
  const paths = Array.isArray(filePath) ? filePath : [filePath];
  const existingCandidate = getCandidate(paths);

  if (!existingCandidate) {
    return null;
  }

  return existingCandidate.path;
}
