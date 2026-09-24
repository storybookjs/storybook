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
    return loadCsf(source, { makeTitle: () => title }).parse();
  } catch {
    return undefined;
  }
}

/** Resolves the primary component from an already-parsed CSF file's `meta.component`. */
export function resolveComponentFromCsf(
  csf: CsfFile,
  storyFilePath: string
): MetaComponentResolution {
  return resolveMetaComponent(csf, storyFilePath);
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
  const csf = parseStoryFile(storyFilePath, title);
  if (!csf) {
    return { reason: 'no-meta-component' };
  }

  return resolveComponentFromCsf(csf, storyFilePath);
}

/** One subcomponent a story file's meta declares, resolved to the component it names. */
export interface ResolvedStorySubcomponent {
  /** CSF object key the subcomponent is declared under. */
  name: string;
  /** Identifier the declaration names, as written (before default-export and alias resolution). */
  componentName: string;
  resolution: MetaComponentResolution;
}

/**
 * An already-parsed CSF file → the subcomponents its meta declares, if any.
 *
 * Each declared `{ key: Component }` entry resolves through the same import, namespace, and
 * reference following as `meta.component` itself. Takes a parsed `CsfFile` so callers that already
 * hold one (e.g. having just resolved the primary component from it) never parse the story file twice.
 */
export function resolveSubcomponentsFromCsf(
  csf: CsfFile,
  storyFilePath: string
): ResolvedStorySubcomponent[] {
  return extractDeclaredSubcomponents(csf).map(({ name, componentName, node }) => ({
    name,
    componentName,
    resolution: resolveMetaComponent(csf, storyFilePath, node),
  }));
}

/**
 * Story file → the subcomponents its meta declares, if any.
 *
 * Parses the file itself; prefer {@link resolveSubcomponentsFromCsf} when a `CsfFile` for this
 * story is already in hand, to avoid parsing it twice.
 */
export function resolveStorySubcomponents(
  storyFilePath: string,
  title = 'Docgen'
): ResolvedStorySubcomponent[] {
  const csf = parseStoryFile(storyFilePath, title);
  if (!csf) {
    return [];
  }

  return resolveSubcomponentsFromCsf(csf, storyFilePath);
}
