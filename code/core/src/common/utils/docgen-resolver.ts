import { extname } from 'node:path';

import { ResolverFactory } from 'oxc-resolver';

export class ReactDocgenResolveError extends Error {
  // the magic string that react-docgen uses to check if a module is ignored
  readonly code = 'MODULE_NOT_FOUND';

  constructor(filename: string) {
    super(`'${filename}' was ignored by react-docgen.`);
  }
}

/* The below code was copied from:
 * https://github.com/reactjs/react-docgen/blob/df2daa8b6f0af693ecc3c4dc49f2246f60552bcb/packages/react-docgen/src/importer/makeFsImporter.ts#L14-L63
 * because it wasn't exported from the react-docgen package.
 */

// These extensions are sorted by priority
// resolve() will check for files in the order these extensions are sorted
export const RESOLVE_EXTENSIONS = [
  '.js',
  '.ctsx', // These were originally not in the code, I added them
  '.mtsx', // These were originally not in the code, I added them
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.jsx',
] as const;

const docgenResolver = new ResolverFactory({
  extensions: [...RESOLVE_EXTENSIONS],
});

const docgenResolverExact = new ResolverFactory({
  extensions: [],
});

function resolveSync(filename: string, basedir: string, exact = false): string {
  const result = (exact ? docgenResolverExact : docgenResolver).sync(basedir, filename);
  if (result.path) {
    return result.path;
  }
  throw new Error(result.error ?? `Cannot resolve '${filename}' from '${basedir}'`);
}

export function defaultLookupModule(filename: string, basedir: string): string {
  try {
    return resolveSync(filename, basedir);
  } catch (error) {
    const ext = extname(filename);

    // if we try to import a JavaScript file it might be that we are actually pointing to
    // a TypeScript file. This can happen in ES modules as TypeScript requires to import other
    // TypeScript files with .js extensions
    // https://www.typescriptlang.org/docs/handbook/esm-node.html#type-in-packagejson-and-new-extensions
    switch (ext) {
      case '.js':
      case '.mjs':
      case '.cjs': {
        // Try .ts first, then fall back to .tsx (for React components using ESM-style .js imports)
        const base = filename.slice(0, -2);
        try {
          return resolveSync(`${base}ts`, basedir, true);
        } catch {
          return resolveSync(`${base}tsx`, basedir, true);
        }
      }
      case '.jsx':
        return resolveSync(`${filename.slice(0, -3)}tsx`, basedir, true);
      default:
        throw error;
    }
  }
}
