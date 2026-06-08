import type {
  DocgenPayload,
  DocgenProviderInput,
  DocgenSubcomponent,
  StrictArgTypes,
} from 'storybook/internal/types';

import { getStoryImportPathFromEntry } from 'storybook/internal/common';
import path from 'pathe';

import { buildReactComponentDocgenFromResolved } from '../componentManifest/buildReactComponentDocgen.ts';
import type { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type { ComponentDoc } from '../componentManifest/componentMeta/componentMetaExtractor.ts';
import type {
  ComponentRef,
  StoryRef,
  TypescriptOptions,
} from '../componentManifest/getComponentImports.ts';
import { resolveStoryFileComponents } from '../componentManifest/resolveComponents.ts';
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

/** Converts one RCM `ComponentDoc` into the `StrictArgTypes` shape consumed by args tables. */
function extractArgTypesFromComponentMeta(componentMeta: ComponentDoc | undefined) {
  return componentMeta
    ? ((extractArgTypes({ __docgenInfo: componentMeta }) ?? undefined) as
        | StrictArgTypes
        | undefined)
    : undefined;
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

/**
 * Build a {@link DocgenPayload} for the component found in one CSF story file.
 *
 * Uses {@link resolveStoryFileComponents} and {@link buildReactComponentDocgenFromResolved} for
 * shared field shaping, runs RCM `batchExtract`, then returns the resolved docgen in the same
 * shape as the experimental component manifest (including `reactComponentMeta` when present).
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

  return addArgTypesFromComponentMeta(componentDocgen);
}
