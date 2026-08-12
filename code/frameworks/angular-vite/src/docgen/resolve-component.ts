import type { MetaComponentResolution } from 'storybook/internal/common';
import { createMetaComponentResolver } from 'storybook/internal/common';
import { loadCsf } from 'storybook/internal/csf-tools';

import { readFileSync } from 'node:fs';

// Angular has no single-file-component format, so the JS/TS extensions the resolver already tries
// are enough.
const resolveMetaComponent = createMetaComponentResolver();

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
  let csf;
  try {
    csf = loadCsf(readFileSync(storyFilePath, 'utf8'), { makeTitle: () => title }).parse();
  } catch {
    return { reason: 'no-meta-component' };
  }

  return resolveMetaComponent(csf, storyFilePath);
}
