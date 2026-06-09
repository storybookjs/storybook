import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';

import { getStoryImportPathFromEntry } from 'storybook/internal/common';
import path from 'pathe';

import { buildReactComponentDocgenFromResolved } from '../componentManifest/buildReactComponentDocgen.ts';
import type { ComponentMetaManager } from '../componentManifest/componentMeta/ComponentMetaManager.ts';
import type {
  ComponentRef,
  StoryRef,
  TypescriptOptions,
} from '../componentManifest/getComponentImports.ts';
import { resolveStoryFileComponents } from '../componentManifest/resolveComponents.ts';

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

  return componentDocgen;
}
