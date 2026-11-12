import type {
  DocgenPayload,
  DocgenProviderInput,
  DocgenSubcomponent,
  IndexEntry,
  StrictArgTypes,
} from 'storybook/internal/types';

import { getStoryImportPathFromEntry } from 'storybook/internal/common';
import path from 'pathe';

import { buildComponentDocgenFromResolved } from '../componentManifest/buildReactComponentDocgen.ts';
import type { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { ComponentDoc } from '../componentManifest/componentMeta/componentMetaExtractor.ts';
import type {
  ComponentRef,
  StoryRef,
  TypescriptOptions,
} from '../componentManifest/getComponentImports.ts';
import {
  type ResolvedStoryFile,
  resolveStoryFileComponents,
} from '../componentManifest/resolveComponents.ts';
import { extractArgTypes } from '../extractArgTypes.ts';

export interface BuildDocgenContext {
  componentMetaManager: ComponentMetaManager;
  typescriptOptions?: Partial<TypescriptOptions>;
  /** Resolve a CSF import path to an absolute file path. Defaults to `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
}

type ReactDocgenPayload = DocgenPayload & {
  reactComponentMeta?: ComponentDoc;
  subcomponents?: Record<string, DocgenSubcomponent & { reactComponentMeta?: ComponentDoc }>;
};

const REACT_ATTRIBUTE_INTERFACES = new Set(['Attributes', 'RefAttributes', 'ClassAttributes']);

/** `key` and `ref` that React's own types add to every element, not props the component reads. */
function isReactAttribute(prop: ComponentDoc['props'][string]) {
  return (
    !!prop.parent &&
    REACT_ATTRIBUTE_INTERFACES.has(prop.parent.name) &&
    /(^|[\\/])node_modules[\\/]/.test(prop.parent.fileName)
  );
}

/** Converts one RCM `ComponentDoc` into the `StrictArgTypes` shape consumed by args tables. */
export function extractArgTypesFromComponentMeta(
  componentMeta: ComponentDoc | undefined
): StrictArgTypes | undefined {
  if (!componentMeta) {
    return undefined;
  }
  // RCM defaults are source text, so a string default already carries its quotes. Without
  // `computed`, the shared conversion mistakes them for react-docgen-typescript output and quotes
  // any unquoted value (such as an unresolved identifier) a second time.
  const props = Object.fromEntries(
    Object.entries(componentMeta.props)
      .filter(([, prop]) => !isReactAttribute(prop))
      .map(([name, prop]) => [
        name,
        prop.defaultValue
          ? { ...prop, defaultValue: { ...prop.defaultValue, computed: false } }
          : prop,
      ])
  );
  return extractArgTypes({ __docgenInfo: { ...componentMeta, props } }) ?? undefined;
}

/**
 * Adds renderer-converted argTypes to the manifest-shaped React docgen payload.
 *
 * The service keeps the raw `reactComponentMeta` data for non-UI consumers, but UI consumers should
 * read `argTypes` so they do not need to know about React-specific docgen engine output.
 */
function addArgTypesFromComponentMeta(payload: ReactDocgenPayload): DocgenPayload {
  const argTypes = extractArgTypesFromComponentMeta(payload.reactComponentMeta);
  const subcomponents = payload.subcomponents
    ? Object.fromEntries(
        Object.entries(payload.subcomponents).map(([name, subcomponent]) => [
          name,
          {
            ...subcomponent,
            argTypes: extractArgTypesFromComponentMeta(subcomponent.reactComponentMeta),
          },
        ])
      )
    : undefined;

  return {
    ...payload,
    ...(argTypes ? { argTypes } : {}),
    ...(subcomponents ? { subcomponents } : {}),
  };
}

/** The refs extraction needs for one story file: its component and its resolvable subcomponents. */
export function toStoryRefs(
  storyPath: string,
  { component, subcomponents }: Pick<ResolvedStoryFile, 'component' | 'subcomponents'>
): StoryRef[] {
  return [component, ...subcomponents.map((sub) => sub.component)]
    .filter((ref): ref is ComponentRef => ref !== undefined)
    .map((ref) => ({ storyPath, component: ref }));
}

/**
 * Collect the refs of every story file in a run, for {@link ComponentMetaManager.setBatch}.
 *
 * A story file that cannot be read or parsed contributes nothing: its own extraction reports it.
 */
export async function resolveBatchStoryRefs(
  entries: readonly IndexEntry[],
  context: Pick<BuildDocgenContext, 'typescriptOptions' | 'resolvePath'> = {}
): Promise<StoryRef[]> {
  const refs = await Promise.all(
    entries.map(async (entry) => {
      const storyFilePath = getStoryImportPathFromEntry(entry);
      if (!storyFilePath) {
        return [];
      }
      const storyPath = resolveStoryPath(storyFilePath, context);
      try {
        const resolved = await resolveStoryFileComponents({
          storyPath,
          title: entry.title,
          typescriptOptions: context.typescriptOptions,
          docgenEngine: 'react-component-meta',
        });
        return toStoryRefs(storyPath, resolved);
      } catch {
        return [];
      }
    })
  );
  return refs.flat();
}

const resolveStoryPath = (
  storyFilePath: string,
  { resolvePath }: Pick<BuildDocgenContext, 'resolvePath'>
) => (resolvePath ? resolvePath(storyFilePath) : path.join(process.cwd(), storyFilePath));

/**
 * Build a {@link DocgenPayload} for the component found in one CSF story file.
 *
 * Uses {@link resolveStoryFileComponents} and {@link buildComponentDocgenFromResolved} for
 * shared field shaping, runs RCM `batchExtract`, then returns component docgen without story
 * snippets (those live in `core/story-docs`).
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

  const storyPath = resolveStoryPath(storyFilePath, context);

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

  const { csf, componentName, component, subcomponents, storyFile } = resolved;

  const storyRefs = toStoryRefs(storyPath, resolved);
  if (storyRefs.length > 0) {
    context.componentMetaManager.batchExtract(storyRefs);
  }

  const componentDocgen = buildComponentDocgenFromResolved({
    entry: input.entry,
    storyPath,
    storyFilePath,
    storyFile,
    csf,
    componentName,
    component,
    subcomponents,
    docgenEngine: 'react-component-meta',
  });

  return addArgTypesFromComponentMeta(componentDocgen);
}
