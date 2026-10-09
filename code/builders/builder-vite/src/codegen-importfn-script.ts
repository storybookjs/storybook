import type { StoryIndex } from 'storybook/internal/types';

import { genDynamicImport, genObjectFromRawEntries } from 'knitwork';
import { join, normalize, relative } from 'pathe';
import { dedent } from 'ts-dedent';

import { getUniqueImportPaths } from './utils/unique-import-paths.ts';

/**
 * This function takes the story index and creates a mapping between the stories' relative paths to
 * the working directory and their dynamic imports. The import is done in an asynchronous function
 * to delay loading and to allow Vite to split the code into smaller chunks. It then creates a
 * function, `importFn(path)`, which resolves a path to an import function and this is called by
 * Storybook to fetch a story dynamically when needed.
 */
export function generateImportFnScriptCode(index: StoryIndex): string {
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
      const relativePath = normalize(relative(process.cwd(), importPath));
      const normalizedRelativePath = relativePath.startsWith('../')
        ? relativePath
        : `./${relativePath}`;

      const absolutePath = normalize(join(process.cwd(), importPath));

      return [normalizedRelativePath, genDynamicImport(absolutePath)];
    }
  );

  // Safari resolves a second import() of a module that is still in its top-level await at once,
  // with the exports of the module undefined: https://bugs.webkit.org/show_bug.cgi?id=242740. So
  // the import of a story file that is still loading is shared.
  return dedent`
    const importers = ${genObjectFromRawEntries(objectEntries)};

    const loading = new Map();

    export async function importFn(path) {
      let loaded = loading.get(path);
      if (!loaded) {
        loaded = importers[path]();
        loading.set(path, loaded);
        const done = () => loading.delete(path);
        loaded.then(done, done);
      }
      return await loaded;
    }
  `;
}
