import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { preprocess } from 'svelte/compiler';

import type {
  DocgenPayload,
  DocgenProviderInput,
  DocgenSubcomponent,
} from 'storybook/internal/types';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { extractComponentDescription } from 'storybook/internal/csf-tools';

import { buildApiDescription } from './api-description/api-description.ts';
import { createServerArgTypes } from './arg-types/create-server-arg-types.ts';
import {
  resolveStoryComponent,
  resolveStorySubcomponents,
} from './resolve-component/resolve-component.ts';
import type { SvelteComponentMetaManager } from './component-meta/svelte-project-manager.ts';

export type BuildDocgenContext = { componentMetaManager: SvelteComponentMetaManager };

// The resolver follows symlinks, so a component path is taken relative to the story file as the
// index wrote it; then a symlinked story folder, as in linked sandboxes, gives the same path.
function pathFromStory(storyPath: string, componentPath: string): string {
  const fromStory = relative(dirname(realpathSync(resolve(storyPath))), componentPath);
  const path = join(dirname(storyPath), fromStory).replaceAll('\\', '/');
  return isAbsolute(path) || path.startsWith('../') ? path : `./${path}`;
}

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
    const docs = await componentDocs(component.componentPath, component.name, context);
    const subcomponents: Record<string, DocgenSubcomponent> = {};
    for (const [name, subcomponent] of Object.entries(
      await resolveStorySubcomponents(input.entry)
    )) {
      try {
        subcomponents[name] = {
          name,
          path: pathFromStory(path, subcomponent.componentPath),
          ...(await componentDocs(subcomponent.componentPath, name, context)),
        };
      } catch {
        continue;
      }
    }
    return {
      ...base,
      name: component.name,
      ...docs,
      ...(Object.keys(subcomponents).length ? { subcomponents } : {}),
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

async function componentDocs(componentPath: string, name: string, context: BuildDocgenContext) {
  const source = await readFile(componentPath, 'utf8');
  const documentationSource = await preprocess(source, { style: () => ({ code: '' }) });
  const docgen = context.componentMetaManager.generateDocgen(componentPath, {
    server: true,
    documentationSource: documentationSource.code,
  });
  return {
    ...extractComponentDescription(undefined, docgen.description, docgen.jsDocTags),
    argTypes: createServerArgTypes(docgen),
    apiDescription: buildApiDescription(name, docgen),
  };
}
