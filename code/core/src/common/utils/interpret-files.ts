import { existsSync } from 'node:fs';
import { extname } from 'node:path';

import resolve from 'resolve';

const typescriptFallbackExtensions: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.mjs': ['.mts', '.mtsx'],
  '.cjs': ['.cts', '.ctsx'],
  '.jsx': ['.tsx'],
};

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
    const fallbackExtensions = typescriptFallbackExtensions[ext];

    if (!fallbackExtensions) {
      throw error;
    }

    let fallbackError: unknown = error;
    const baseId = id.slice(0, -ext.length);

    for (const fallbackExtension of fallbackExtensions) {
      try {
        return resolve.sync(`${baseId}${fallbackExtension}`, { ...mergedOptions, extensions: [] });
      } catch (err) {
        fallbackError = err;
      }
    }

    throw fallbackError;
  }
}
