import { existsSync } from 'node:fs';
import { extname } from 'node:path';

import { ResolverFactory } from 'oxc-resolver';

import { storybookConfigExtensions } from '../../shared/constants/extensions.ts';

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
    if (['.js', '.mjs', '.cjs'].includes(ext)) {
      const base = id.slice(0, -2);

      try {
        return resolveSync(`${base}ts`, options.basedir);
      } catch {
        return resolveSync(`${base}tsx`, options.basedir);
      }
    }

    if (ext === '.jsx') {
      return resolveSync(`${id.slice(0, -3)}tsx`, options.basedir);
    }

    throw error;
  }
}

function resolveSync(id: string, basedir: string): string {
  const result = importResolver.sync(basedir, id);
  if (result.path) {
    return result.path;
  }
  throw new Error(result.error ?? `Cannot resolve module '${id}' from '${basedir}'`);
}
