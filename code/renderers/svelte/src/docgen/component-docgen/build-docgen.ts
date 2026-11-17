import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { extractComponentDescription } from 'storybook/internal/csf-tools';

import { createServerArgTypes } from './arg-types/create-server-arg-types.ts';
import { resolveStoryComponent } from './resolve-component/resolve-component.ts';
import { analyzeComponent, type createDocinfoCache } from './analyze-component.ts';

export type BuildDocgenContext = { cache: ReturnType<typeof createDocinfoCache> };

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
    const docgen = await analyzeComponent(component.componentPath, context.cache);
    return {
      ...base,
      name: component.name,
      ...extractComponentDescription(undefined, docgen.docComment, {
        ...(docgen.deprecatedMessage !== undefined
          ? { deprecated: [docgen.deprecatedMessage] }
          : {}),
        ...(docgen.examples.length > 0 ? { example: docgen.examples } : {}),
      }),
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
