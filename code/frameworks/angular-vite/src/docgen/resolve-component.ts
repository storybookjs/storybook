import {
  createMetaComponentResolver,
  createModuleResolver,
  jsTsSourceExtensions,
} from 'storybook/internal/common';
import type { CsfFile } from 'storybook/internal/csf-tools';
import { loadCsf } from 'storybook/internal/csf-tools';

import { readFileSync } from 'node:fs';

// Angular has no single-file-component format, so the JS/TS extensions the resolver already tries
// are enough. One instance per process: the resolver caches its module resolutions.
// The annotation keeps declaration emit from naming core's unexported babel `Node` (TS2883).
export const resolveMetaComponent: ReturnType<typeof createMetaComponentResolver> =
  createMetaComponentResolver();

const storyImportResolver = createModuleResolver({
  extensions: [...jsTsSourceExtensions],
  mainFields: ['module', 'main'],
  tsconfig: 'auto',
});

/** Resolves an import specifier from a story file to a file path, `undefined` when it does not. */
export function resolveStoryImport(fromFile: string, specifier: string): string | undefined {
  try {
    return storyImportResolver.resolveFileSync(fromFile, specifier);
  } catch {
    return undefined;
  }
}

export function parseStoryFile(storyFilePath: string, title: string): CsfFile | undefined {
  try {
    const source = readFileSync(storyFilePath, 'utf8');
    return loadCsf(source, { makeTitle: () => title }).parse();
  } catch {
    return undefined;
  }
}
