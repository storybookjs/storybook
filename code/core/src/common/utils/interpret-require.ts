import { builtinModules } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';

import { readJSON } from '@ndelangen/fs-extra-unified';
import { findUpMultiple } from 'find-up';
import { dedent } from 'ts-dedent';

import { cache } from './cache';
import { getInterpretedFileWithExt } from './interpret-files';
import { getProjectRoot } from './paths';

export const nodeInternals: string[] = [
  'module',
  'node:module',
  ...builtinModules.flatMap((m: string) => [m, `node:${m}`]),
];

export async function interopRequireDefault(filePath: string) {
  let location = filePath;

  if (filePath.match(/\.tsx?$/)) {
    const { build } = await import('esbuild');
    const file = relative(process.cwd(), filePath)
      .replaceAll(sep, '-')
      .replace(/\.tsx?$/, '.mjs');
    location = join(cache.basePath, file);
    const packageJsons = await findUpMultiple('package.json', {
      cwd: dirname(filePath),
      stopAt: getProjectRoot(),
    });

    const list = await Promise.all(
      packageJsons.map(async (packageJson) => {
        const json = await readJSON(packageJson);
        return [
          ...new Set([
            ...Object.keys(json.dependencies || {}),
            ...Object.keys(json.peerDependencies || {}),
          ]),
        ];
      })
    );

    const dependencies = [...new Set(list.flat())];

    const external = [...nodeInternals, ...dependencies];
    await build({
      entryPoints: [filePath],
      outfile: location,
      platform: 'neutral',
      format: 'esm',
      target: 'node18',
      bundle: true,
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
      mainFields: ['main', 'module', 'node'],
      conditions: ['node', 'module', 'import', 'require'],
      external: external,
    });
  }

  let result = await import(location).catch((e) => {
    console.error(e);
    return null;
  });

  if (!result) {
    result = require(location);
  }

  if (!result) {
    throw new Error(`Unable to import ${filePath}`);
  }

  const isES6DefaultExported =
    typeof result === 'object' && result !== null && typeof result.default !== 'undefined';

  return isES6DefaultExported ? result.default : result;
}

async function getCandidate(paths: string[]) {
  for (let i = 0; i < paths.length; i += 1) {
    const candidate = await getInterpretedFileWithExt(paths[i]);

    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

export async function serverRequire(filePath: string | string[]) {
  const candidatePath = await serverResolve(filePath);

  if (!candidatePath) {
    return null;
  }

  return interopRequireDefault(candidatePath);
}

export async function serverResolve(filePath: string | string[]): Promise<string | null> {
  const paths = Array.isArray(filePath) ? filePath : [filePath];
  const existingCandidate = await getCandidate(paths);

  if (!existingCandidate) {
    return null;
  }

  return existingCandidate.path;
}
