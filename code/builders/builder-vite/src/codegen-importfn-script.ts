import type { StoryIndex } from 'storybook/internal/types';

import { genDynamicImport, genObjectFromRawEntries } from 'knitwork';
import { join, normalize } from 'pathe';
import { dedent } from 'ts-dedent';

/**
 * This function takes an array of stories and creates a mapping between the stories' relative paths
 * to the working directory and their dynamic imports. The import is done in an asynchronous
 * function to delay loading and to allow Vite to split the code into smaller chunks. It then
 * creates a function, `importFn(path)`, which resolves a path to an import function and this is
 * called by Storybook to fetch a story dynamically when needed.
 */
export async function generateImportFnScriptCode(index: StoryIndex): Promise<string> {
  const uniqueImportPaths = [
    ...new Set(Object.values(index.entries).map((entry) => entry.importPath)),
  ];

  const objectEntries: [string, string][] = uniqueImportPaths.map((importPath) => {
    if (importPath.startsWith('virtual:')) {
      console.log('LOG: virtual entry', importPath);
      return [importPath, genDynamicImport(importPath)];
    }

    const absolutePath = join(process.cwd(), importPath);
    return [importPath, genDynamicImport(normalize(absolutePath))];
  });

  return dedent`
    const importers = ${genObjectFromRawEntries(objectEntries)};

    export async function importFn(path) {
      return await importers[path]();
    }
  `;
}
