import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { extractComponentDescription } from 'storybook/internal/csf-tools';

import { createServerArgTypes } from './arg-types/create-server-arg-types.ts';
import { resolveStoryComponent } from './resolve-component/resolve-component.ts';
import { generateDocgen, type DocgenCache } from './svelte2tsx/generate-docgen.ts';

export type BuildDocgenContext = { cache: DocgenCache };

export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<DocgenPayload | undefined> {
  const path = getStoryImportPathFromEntry(input.entry);
  if (!path) return undefined;
  const base = {
    id: getComponentIdFromEntry(input.entry),
    name: input.entry.title.split('/').at(-1) ?? input.entry.title,
    path,
    jsDocTags: {},
    renderer: 'svelte',
  };
  try {
    const component = await resolveStoryComponent(input.entry);
    if (!component) return undefined;
    const docgen = generateDocgen(component.componentPath, context.cache);
    return {
      ...base,
      name: component.name,
      ...extractComponentDescription(undefined, docgen.description, docgen.jsDocTags),
      argTypes: createServerArgTypes(docgen),
    };
  } catch (error) {
    return {
      ...base,
      error: {
        name: 'Svelte docgen failed',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
