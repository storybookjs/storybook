import { existsSync } from 'node:fs';
import { extname } from 'node:path';

import resolve from 'resolve';

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

export function resolveImport(id: string, options: resolve.SyncOpts): string {
  const mergedOptions: resolve.SyncOpts = {
    extensions: supportedExtensions,
    packageFilter(pkg) {
      // Prefer 'module' over 'main' if available
      if (pkg.module) {
        pkg.main = pkg.module;
      }
      return pkg;
    },
    ...options,
  };

  try {
    return resolve.sync(id, { ...mergedOptions });
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
    return resolve.sync(newId, { ...mergedOptions, extensions: [] });
  }
}
