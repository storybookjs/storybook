import type {
  DocgenPayload,
  DocgenProviderInput,
  DocgenStory,
  DocgenSubcomponent,
} from 'storybook/internal/types';

import { getStoryImportPathFromEntry } from 'storybook/internal/common';
import path from 'pathe';

import {
  type ReactResolvedComponentDocgen,
  type ReactResolvedSubcomponentDocgen,
  buildReactComponentDocgenFromResolved,
} from '../componentManifest/buildReactComponentDocgen.ts';
import type { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { ComponentDoc } from '../componentManifest/componentMeta/componentMetaExtractor.ts';
import type {
  ComponentRef,
  StoryRef,
  TypescriptOptions,
} from '../componentManifest/getComponentImports.ts';
import { resolveStoryFileComponents } from '../componentManifest/resolveComponents.ts';

/**
 * Prop descriptor emitted by the React docgen provider, mirroring RCM's `PropItem`. The core
 * docgen contract types props as `unknown` (the shape is integration-specific); this is the
 * concrete shape the React renderer contributes.
 */
interface ReactDocgenProp {
  name: string;
  required: boolean;
  type: ComponentDoc['props'][string]['type'];
  description: string;
  defaultValue: ComponentDoc['props'][string]['defaultValue'];
}

function mapProps(doc: ComponentDoc | undefined): ReactDocgenProp[] {
  if (!doc) {
    return [];
  }
  return Object.values(doc.props).map((prop) => ({
    name: prop.name,
    required: prop.required,
    type: prop.type,
    description: prop.description,
    defaultValue: prop.defaultValue,
  }));
}

function mapSubcomponentToDocgen(sub: ReactResolvedSubcomponentDocgen): DocgenSubcomponent {
  return {
    name: sub.name,
    path: sub.path,
    description: sub.description,
    summary: sub.summary,
    import: sub.import,
    jsDocTags: sub.jsDocTags,
    props: mapProps(sub.reactComponentMeta),
    error: sub.error,
  };
}

function toDocgenPayload(resolved: ReactResolvedComponentDocgen): DocgenPayload {
  const stories: DocgenStory[] | undefined =
    resolved.stories.length > 0
      ? resolved.stories.map((story) => ({
          id: story.id,
          name: story.name,
          snippet: story.snippet,
          description: story.description,
          summary: story.summary,
          error: story.error,
        }))
      : undefined;

  const subcomponents =
    resolved.subcomponents && Object.keys(resolved.subcomponents).length > 0
      ? Object.fromEntries(
          Object.entries(resolved.subcomponents).map(([key, sub]) => [
            key,
            mapSubcomponentToDocgen(sub),
          ])
        )
      : undefined;

  return {
    componentId: resolved.componentId,
    name: resolved.name,
    path: resolved.path,
    import: resolved.import,
    description: resolved.description ?? '',
    summary: resolved.summary,
    jsDocTags: resolved.jsDocTags,
    props: mapProps(resolved.reactComponentMeta),
    error: resolved.error,
    ...(subcomponents ? { subcomponents } : {}),
    ...(stories ? { stories } : {}),
  };
}

export interface BuildDocgenContext {
  componentMetaManager: ComponentMetaManager;
  typescriptOptions?: Partial<TypescriptOptions>;
  /** Resolve a CSF import path to an absolute file path. Defaults to `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
}

/**
 * Build a {@link DocgenPayload} for the component found in one CSF story file.
 *
 * Uses {@link resolveStoryFileComponents} and {@link buildReactComponentDocgenFromResolved} for
 * shared field shaping, runs RCM `batchExtract`, then maps the resolved docgen into the open-service
 * schema via {@link toDocgenPayload}.
 *
 * Returns `undefined` when the story file cannot be read or parsed — the docgen-service provider
 * chain treats undefined as "no docgen here, fall through to the next provider". Resolution errors
 * surfaced on the resolved docgen are returned as a payload (not undefined).
 */
export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<DocgenPayload | undefined> {
  const storyFilePath = getStoryImportPathFromEntry(input.entry);
  if (!storyFilePath) {
    return undefined;
  }

  const resolvePath =
    context.resolvePath ?? ((importPath: string) => path.join(process.cwd(), importPath));
  const storyPath = resolvePath(storyFilePath);

  let resolved;
  try {
    resolved = await resolveStoryFileComponents({
      storyPath,
      title: input.entry.title,
      typescriptOptions: context.typescriptOptions,
      docgenEngine: 'react-component-meta',
    });
  } catch {
    return undefined;
  }

  const { csf, componentName, component, allComponents, subcomponents, storyFile } = resolved;

  const usableSubcomponents = subcomponents.filter(
    (sub): sub is { name: string; component: ComponentRef } => sub.component !== undefined
  );

  const storyRefs: StoryRef[] = [
    ...(component ? [{ storyPath, component }] : []),
    ...usableSubcomponents.map((sub) => ({ storyPath, component: sub.component })),
  ];
  if (storyRefs.length > 0) {
    context.componentMetaManager.batchExtract(storyRefs);
  }

  const componentDocgen = buildReactComponentDocgenFromResolved({
    entry: input.entry,
    storyPath,
    storyFilePath,
    storyFile,
    csf,
    componentName,
    component,
    allComponents,
    subcomponents,
    docgenEngine: 'react-component-meta',
  });

  return toDocgenPayload(componentDocgen);
}
