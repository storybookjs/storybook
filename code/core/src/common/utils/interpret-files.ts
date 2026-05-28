import { existsSync } from 'node:fs';
import { extname } from 'node:path';

import { ResolverFactory } from 'oxc-resolver';

import { storybookConfigExtensions } from '../../shared/constants/extensions.ts';

const typescriptFallbackExtensions: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.mjs': ['.mts', '.mtsx'],
  '.cjs': ['.cts', '.ctsx'],
  '.jsx': ['.tsx'],
};

export const supportedExtensions = storybookConfigExtensions;

export function getInterpretedFile(pathToFile: string) {
  return supportedExtensions
    .map((ext) => (pathToFile.endsWith(ext) ? pathToFile : `${pathToFile}${ext}`))
    .find((candidate) => existsSync(candidate));
}

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
    const fallbackExtensions = typescriptFallbackExtensions[ext];

    if (!fallbackExtensions) {
      throw error;
    }

    let fallbackError: unknown = error;
    const baseId = id.slice(0, -ext.length);

    for (const fallbackExtension of fallbackExtensions) {
      try {
        return resolveSync(`${baseId}${fallbackExtension}`, options.basedir);
      } catch (err) {
        fallbackError = err;
      }
    }

    throw fallbackError;
  }
}

function resolveSync(id: string, basedir: string): string {
  const result = importResolver.sync(basedir, id);
  if (result.path) {
    return result.path;
  }
  throw new Error(result.error ?? `Cannot resolve module '${id}' from '${basedir}'`);
}
