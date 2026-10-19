import type { StoryIndex } from 'storybook/internal/types';

import { genDynamicImport, genImport, genObjectFromRawEntries } from 'knitwork';
import { join, normalize } from 'pathe';
import { dedent } from 'ts-dedent';

import { toImportPath } from './utils/import-path.ts';
import { getUniqueImportPaths } from './utils/unique-import-paths.ts';

/**
 * This function takes the story index and creates a mapping between the stories' relative paths to
 * the working directory and their dynamic imports. The import is done in an asynchronous function
 * to delay loading and to allow Vite to split the code into smaller chunks. It then creates a
 * function, `importFn(path)`, which resolves a path to an import function and this is called by
 * Storybook to fetch a story dynamically when needed. With a `moduleLoader`, `importFn` asks its
 * `load(path, importFn)` for every file.
 */
export function generateImportFnScriptCode(index: StoryIndex, moduleLoader?: string): string {
  const objectEntries: [path: string, importStatement: string][] = getUniqueImportPaths(index).map(
    (importPath) => {
      if (importPath.startsWith('virtual:')) {
        return [importPath, genDynamicImport(importPath)];
      }

      /**
       * Relative paths get passed either with no leading './' - e.g. 'src/Foo.stories.js', or with
       * a leading '../', e.g. '../src/Foo.stories.js'. We want to deal in importPaths relative to
       * the working dir, so we normalize
       */
      const absolutePath = normalize(join(process.cwd(), importPath));

      return [toImportPath(importPath), genDynamicImport(absolutePath)];
    }
  );

  const importModule = moduleLoader
    ? 'load(path, (path) => importers[path]())'
    : 'importers[path]()';

  const code = dedent`
    const importers = ${genObjectFromRawEntries(objectEntries)};

    export async function importFn(path) {
      return await ${importModule};
    }
  `;

  return moduleLoader ? `${genImport(moduleLoader, ['load'])}\n\n${code}` : code;
}
