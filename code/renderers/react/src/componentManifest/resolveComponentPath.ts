import {
  findTsconfigPathForPath,
  getTsconfigPathsBaseDir,
  supportedExtensions,
} from 'storybook/internal/common';
import { extractJSDocInfo } from 'storybook/internal/csf-tools';

import * as TsconfigPaths from 'tsconfig-paths';

import { cached } from './utils.ts';

/**
 * Helpers that every docgen engine uses to resolve component imports. They live apart from
 * `reactDocgen.ts`, so loading them does not load the optional `react-docgen` package.
 */

export function matchPath(id: string, importerPath?: string) {
  importerPath ??= process.cwd();
  const tsconfig = getTsConfig(importerPath);

  if (tsconfig.resultType === 'success') {
    const match = TsconfigPaths.createMatchPath(
      getTsconfigPathsBaseDir(tsconfig.configFileAbsolutePath),
      tsconfig.paths,
      ['browser', 'module', 'main']
    );
    return match(id, undefined, undefined, supportedExtensions) ?? id;
  }
  return id;
}

export const getTsConfig = cached(
  (path: string) => {
    // `path` may be a source file (export resolution) or a directory (makeFsImporter basedir).
    const tsconfigPath = findTsconfigPathForPath(path);
    if (!tsconfigPath) {
      return { resultType: 'failed' as const, message: "Couldn't find tsconfig.json" };
    }
    return TsconfigPaths.loadConfig(tsconfigPath);
  },
  { name: 'getTsConfig' }
);

export function getImportTag(docgen: { description?: string }) {
  const jsdocComment = docgen?.description;
  const tags = jsdocComment ? extractJSDocInfo(jsdocComment).tags : undefined;
  return tags?.import?.[0];
}
