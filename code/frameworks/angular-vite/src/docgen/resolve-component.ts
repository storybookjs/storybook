import type { MetaComponentResolution } from 'storybook/internal/common';
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
const resolveMetaComponent = createMetaComponentResolver();

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

export interface ParsedStoryFile {
  source: string;
  csf: CsfFile;
}

export function parseStoryFile(storyFilePath: string, title: string): ParsedStoryFile | undefined {
  try {
    const source = readFileSync(storyFilePath, 'utf8');
    return { source, csf: loadCsf(source, { makeTitle: () => title }).parse() };
  } catch {
    return undefined;
  }
}

/**
 * Story file → the component it documents.
 *
 * Reports `no-meta-component` when the file cannot be read or parsed, which callers treat the same
 * as "no `meta.component` here": there is no Angular component to document either way.
 */
export function resolveStoryComponent(
  storyFilePath: string,
  title = 'Docgen'
): MetaComponentResolution {
  const parsed = parseStoryFile(storyFilePath, title);
  if (!parsed) {
    return { reason: 'no-meta-component' };
  }

  return resolveMetaComponent(parsed.csf, storyFilePath);
}
