import { mkdir, readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findUp } from 'find-up';
import { dedent } from 'ts-dedent';
import type { PackageJson } from 'type-fest';

import {
  dependencies as coreDependencies,
  peerDependencies as corePeerDependencies,
} from '../../../package.json';
import { getInterpretedFileWithExt } from './interpret-files';

let registered = false;

const defaultCacheMap = new Map<string, string>();
const defaultOutDirectory = join(process.cwd(), 'node_modules', '.cache', Date.now().toString());

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
 * @returns The imported module
 *
 *   When the module has a default export, the default export will be returned
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
  { cache = defaultCacheMap, cwd = process.cwd(), out: outDirectory = defaultOutDirectory } = {}
): Promise<T> {
  // TODO: this is a heuristic, we should find a better way
  if (inputPath.includes('node_modules')) {
    return unwrapModule(await import(inputPath));
  }

  const cached = cache.get(inputPath);

  if (!!cached) {
    return unwrapModule(await import(cached));
  }

  const [{ build }, { dependencies, devDependencies, peerDependencies }] = await Promise.all([
    import('esbuild'),
    findUp('package.json', { cwd }).then(
      async (a) => (a ? JSON.parse(await readFile(a, { encoding: 'utf-8' })) : {}) as PackageJson
    ),
    mkdir(outDirectory, { recursive: true }),
  ]);

  const outPath = join(outDirectory, `${cache.size.toString()}.mjs`);

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
    banner: {
      js: dedent`
        /* experimental interopImport generated */
        /* from ${inputPath} */
        /* to ${outPath} */

        import ESM_COMPAT_Module from "node:module";
        import { fileURLToPath as ESM_COMPAT_fileURLToPath } from 'node:url';
        import { dirname as ESM_COMPAT_dirname } from 'node:path';
        const __filename = "${inputPath}";
        const __dirname = ESM_COMPAT_dirname(__filename);
        const require = ESM_COMPAT_Module.createRequire(import.meta.url);
      `,
    },
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
