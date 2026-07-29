import type { StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { getStoryImportPathFromEntry } from 'storybook/internal/common';
import path from 'pathe';

import { buildStoryDocsFromResolved } from '../componentManifest/buildReactComponentDocgen.ts';
import type { TypescriptOptions } from '../componentManifest/getComponentImports.ts';
import { resolveStoryFileComponents } from '../componentManifest/resolveComponents.ts';

export interface BuildStoryDocsContext {
  typescriptOptions?: Partial<TypescriptOptions>;
  /** Resolve a CSF import path to an absolute file path. Defaults to `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
}

/**
 * Build a {@link StoryDocsPayload} for the stories in one CSF story file.
 *
 * Uses {@link resolveStoryFileComponents} and {@link buildStoryDocsFromResolved} without running
 * RCM or any component docgen engine.
 */
export async function buildStoryDocsPayload(
  input: StoryDocsProviderInput,
  context: BuildStoryDocsContext
): Promise<StoryDocsPayload | undefined> {
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

  const { csf, componentName, component, allComponents } = resolved;

  return buildStoryDocsFromResolved({
    entry: input.entry,
    storyPath,
    storyFilePath,
    csf,
    componentName,
    component,
    allComponents,
  });
}
