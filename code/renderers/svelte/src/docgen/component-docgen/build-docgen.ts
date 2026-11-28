import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
  DocgenPayload,
  DocgenProviderInput,
  DocgenSubcomponent,
  DocgenSummary,
} from 'storybook/internal/types';
import {
  componentPathFromStory,
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
} from 'storybook/internal/common';

import { buildApiDescription } from './api-description/api-description.ts';
import { createServerArgTypes } from './arg-types/create-server-arg-types.ts';
import { readComponentDescription } from './component-comment.ts';
import {
  resolveStoryComponent,
  resolveStorySubcomponents,
} from './resolve-component/resolve-component.ts';
import type { SvelteComponentMetaManager } from './component-meta/svelte-project-manager.ts';

export type BuildDocgenContext = { componentMetaManager: SvelteComponentMetaManager };

// What the source says of the component a story file documents: its name, and the docs in its
// `@component` comment. `undefined` when the story file documents no Svelte component.
async function describeStoryComponent(input: DocgenProviderInput) {
  const component = await resolveStoryComponent(input.entry);
  return (
    component && {
      component,
      docs: { name: component.name, ...(await readDocs(component.componentPath)) },
    }
  );
}

const titleName = ({ entry }: DocgenProviderInput) => entry.title.split('/').at(-1) ?? entry.title;

// The part of `buildDocgenPayload` that comes from source, which needs no type checker.
export async function buildDocgenSummary(
  input: DocgenProviderInput
): Promise<DocgenSummary | undefined> {
  if (!getStoryImportPathFromEntry(input.entry)) return undefined;
  try {
    const described = await describeStoryComponent(input);
    if (!described) return undefined;
    const { name, description, summary } = described.docs;
    return { name, description, summary };
  } catch {
    return { name: titleName(input) };
  }
}

export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<DocgenPayload | undefined> {
  const path = getStoryImportPathFromEntry(input.entry);
  if (!path) return undefined;
  const base = {
    id: getComponentIdFromEntry(input.entry),
    name: titleName(input),
    path,
    jsDocTags: {},
    renderer: 'svelte',
  };
  let docs: Awaited<ReturnType<typeof readDocs>> | undefined;
  try {
    const described = await describeStoryComponent(input);
    if (!described) return undefined;
    const { component } = described;
    docs = described.docs;
    const props = componentProps(component.componentPath, component.name, context);
    const subcomponents: Record<string, DocgenSubcomponent> = {};
    for (const [name, subcomponent] of Object.entries(
      await resolveStorySubcomponents(input.entry)
    )) {
      try {
        subcomponents[name] = {
          name,
          path: componentPathFromStory(path, resolve(path), subcomponent.componentPath),
          ...(await readDocs(subcomponent.componentPath)),
          ...componentProps(subcomponent.componentPath, name, context),
        };
      } catch {
        continue;
      }
    }
    return {
      ...base,
      ...docs,
      ...props,
      ...(Object.keys(subcomponents).length ? { subcomponents } : {}),
    };
  } catch (error) {
    return {
      ...base,
      ...docs,
      error: {
        name: 'Svelte docgen failed',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// What the source says of a component, in its `@component` comment.
const readDocs = async (componentPath: string) =>
  readComponentDescription(await readFile(componentPath, 'utf8'));

// The props of a component, which the type checker finds.
function componentProps(componentPath: string, name: string, context: BuildDocgenContext) {
  const docgen = context.componentMetaManager.generateDocgen(componentPath, { server: true });
  return {
    argTypes: createServerArgTypes(docgen),
    apiDescription: buildApiDescription(name, docgen),
  };
}
