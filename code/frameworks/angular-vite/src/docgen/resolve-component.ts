import type { MetaComponentResolution } from 'storybook/internal/common';
import { createMetaComponentResolver } from 'storybook/internal/common';
import type { CsfFile } from 'storybook/internal/csf-tools';
import { loadCsf } from 'storybook/internal/csf-tools';

import { readFileSync } from 'node:fs';

// Angular has no single-file-component format, so the JS/TS extensions the resolver already tries
// are enough. One instance per process: the resolver caches its module resolutions.
const resolveMetaComponent = createMetaComponentResolver();

export interface ParsedStoryFile {
  source: string;
  csf: CsfFile;
}

export function parseStoryFile(storyFilePath: string, title: string): ParsedStoryFile | undefined {
  try {
    // Windows checkouts may use CRLF. Recast records character offsets from the source it
    // parsed; slicing a different line-ending view shifts unevaluable expressions (arrow
    // functions, etc.) by one character per preceding newline.
    const source = readFileSync(storyFilePath, 'utf8').replace(/\r\n/g, '\n');
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
