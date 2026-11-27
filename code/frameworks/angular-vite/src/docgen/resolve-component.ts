import type { MetaComponentResolution } from 'storybook/internal/common';
import {
  createMetaComponentResolver,
  createModuleResolver,
  extractDeclaredSubcomponents,
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

export function parseStoryFile(storyFilePath: string, title: string): CsfFile | undefined {
  try {
    const source = readFileSync(storyFilePath, 'utf8');
    return loadCsf(source, { makeTitle: () => title, fileName: storyFilePath }).parse();
  } catch {
    return undefined;
  }
}

// A declared subcomponent, by the name the meta lists it under, and what it resolved to.
export interface ResolvedStorySubcomponent {
  name: string;
  resolution: MetaComponentResolution;
}

/**
 * Story file → the component it documents, and the subcomponents its meta declares.
 *
 * Reports `no-meta-component` when the file cannot be read or parsed, which callers treat the same
 * as "no `meta.component` here": there is no Angular component to document either way.
 */
export function resolveStoryComponents(
  storyFilePath: string,
  title = 'Docgen'
): { component: MetaComponentResolution; subcomponents: ResolvedStorySubcomponent[] } {
  const csf = parseStoryFile(storyFilePath, title);
  if (!csf) {
    return { component: { reason: 'no-meta-component' }, subcomponents: [] };
  }

  return {
    component: resolveMetaComponent(csf, storyFilePath),
    subcomponents: extractDeclaredSubcomponents(csf).map(({ name, node }) => ({
      name,
      resolution: resolveMetaComponent(csf, storyFilePath, node),
    })),
  };
}
