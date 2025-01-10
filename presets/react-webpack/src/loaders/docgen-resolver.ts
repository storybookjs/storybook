import { extname } from 'node:path';

import resolve from 'resolve';

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
 * watch out: when updating this code, also update the code in code/frameworks/react-vite/src/plugins/docgen-resolver.ts
 */

// These extensions are sorted by priority
// resolve() will check for files in the order these extensions are sorted
export const RESOLVE_EXTENSIONS = [
  '.js',
  '.cts', // These were originally not in the code, I added them
  '.mts', // These were originally not in the code, I added them
  '.ctsx', // These were originally not in the code, I added them
  '.mtsx', // These were originally not in the code, I added them
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.jsx',
];

export function defaultLookupModule(filename: string, basedir: string): string {
  const resolveOptions = {
    basedir,
    extensions: RESOLVE_EXTENSIONS,
    // we do not need to check core modules as we cannot import them anyway
    includeCoreModules: false,
  };

  try {
    return resolve.sync(filename, resolveOptions);
  } catch (error) {
    const ext = extname(filename);
    let newFilename: string;

    // if we try to import a JavaScript file it might be that we are actually pointing to
    // a TypeScript file. This can happen in ES modules as TypeScript requires to import other
    // TypeScript files with .js extensions
    // https://www.typescriptlang.org/docs/handbook/esm-node.html#type-in-packagejson-and-new-extensions
    switch (ext) {
      case '.js':
      case '.mjs':
      case '.cjs':
        newFilename = `${filename.slice(0, -2)}ts`;
        break;

      case '.jsx':
        newFilename = `${filename.slice(0, -3)}tsx`;
        break;
      default:
        throw error;
    }

    return resolve.sync(newFilename, {
      ...resolveOptions,
      // we already know that there is an extension at this point, so no need to check other extensions
      extensions: [],
    });
  }
}
