import { existsSync } from 'node:fs';
import { extname } from 'node:path';

import { ResolverFactory } from 'oxc-resolver';

export const supportedExtensions = [
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.mjs',
  '.mts',
  '.mtsx',
  '.cjs',
  '.cts',
  '.ctsx',
] as const;

export function getInterpretedFile(pathToFile: string) {
  return supportedExtensions
    .map((ext) => (pathToFile.endsWith(ext) ? pathToFile : `${pathToFile}${ext}`))
    .find((candidate) => existsSync(candidate));
}

/**
 * `mainFields: ['module', 'main']` mirrors the previous `packageFilter` callback that rewrote
 * `pkg.main = pkg.module` — both prefer the ESM entry over the CJS entry. Storybook server
 * processes run in Node ESM context, so consuming `pkg.module` is safe.
 */
const importResolver = new ResolverFactory({
  extensions: [...supportedExtensions],
  mainFields: ['module', 'main'],
});

export interface ResolveImportOptions {
  basedir: string;
}

export function resolveImport(id: string, options: ResolveImportOptions): string {
  try {
    return resolveSync(id, options.basedir);
  } catch (error) {
    const ext = extname(id);

    // if we try to import a JavaScript file it might be that we are actually pointing to
    // a TypeScript file. This can happen in ES modules as TypeScript requires to import other
    // TypeScript files with .js extensions
    // https://www.typescriptlang.org/docs/handbook/esm-node.html#type-in-packagejson-and-new-extensions
    const newId = ['.js', '.mjs', '.cjs'].includes(ext)
      ? `${id.slice(0, -2)}ts`
      : ext === '.jsx'
        ? `${id.slice(0, -3)}tsx`
        : null;

    if (!newId) {
      throw error;
    }
    return resolveSync(newId, options.basedir);
  }
}

function resolveSync(id: string, basedir: string): string {
  const result = importResolver.sync(basedir, id);
  if (result.path) {
    return result.path;
  }
  throw new Error(result.error ?? `Cannot resolve module '${id}' from '${basedir}'`);
}
