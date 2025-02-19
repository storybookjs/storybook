import type { StoryIndex } from 'storybook/internal/types';

import { genDynamicImport, genObjectFromRawEntries } from 'knitwork';
import { join, normalize, relative } from 'pathe';
import { dedent } from 'ts-dedent';

import { listStories } from './list-stories';

/**
 * This file is largely based on
 * https://github.com/storybookjs/storybook/blob/d1195cbd0c61687f1720fefdb772e2f490a46584/lib/core-common/src/utils/to-importFn.ts
 */

/**
 * Paths get passed either with no leading './' - e.g. `src/Foo.stories.js`, or with a leading `../`
 * (etc), e.g. `../src/Foo.stories.js`. We want to deal in importPaths relative to the working dir,
 * so we normalize
 */
function toImportPath(relativePath: string) {
  return relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

/**
 * This function takes an array of stories and creates a mapping between the stories' relative paths
 * to the working directory and their dynamic imports. The import is done in an asynchronous
 * function to delay loading and to allow Vite to split the code into smaller chunks. It then
 * creates a function, `importFn(path)`, which resolves a path to an import function and this is
 * called by Storybook to fetch a story dynamically when needed.
 */
export async function generateImportFnScriptCode(index: StoryIndex): Promise<string> {
  const objectEntries: [string, string][] = Object.values(index.entries).map((entry) => {
    if (entry.importPath.startsWith('virtual:')) {
      console.log('LOG: virtual entry', entry.importPath);
      return [entry.importPath, entry.importPath];
    }

    const absolutePath = join(process.cwd(), entry.importPath);
    const relativePath = relative(process.cwd(), absolutePath);
    console.log('LOG: paths', {
      importPath: entry.importPath,
      absolutePath,
      relativePath,
      toImportPathed: toImportPath(relativePath),
      cwd: process.cwd(),
    });
    return [relativePath, genDynamicImport(normalize(absolutePath))];
  });

  return dedent`
    const importers = ${genObjectFromRawEntries(objectEntries)};

    export async function importFn(path) {
      return await importers[path]();
    }
  `;
}
