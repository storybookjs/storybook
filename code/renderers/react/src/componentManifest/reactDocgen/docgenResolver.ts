import { extname } from 'node:path';

import { supportedExtensions } from 'storybook/internal/common';

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
 */
export function defaultLookupModule(filename: string, basedir: string): string {
  const resolveOptions = {
    basedir,
    extensions: supportedExtensions,
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
