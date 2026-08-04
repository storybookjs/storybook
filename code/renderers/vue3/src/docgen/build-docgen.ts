import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import {
  extractComponentDescription,
  extractDescription,
  loadCsf,
} from 'storybook/internal/csf-tools';
import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';

import { extractArgTypes } from '../extractArgTypes.ts';

import type { ComponentMetaChecker } from 'vue-component-meta';

import { type MetaSource, collectComponentMetaSources } from './component-meta.ts';
import { type UnresolvedComponentReason, resolveMetaComponent } from './resolve-component.ts';

type VueDocgenPayload = DocgenPayload & { vueComponentMeta?: MetaSource };

export interface BuildDocgenContext {
  getChecker: (componentFilePath: string) => ComponentMetaChecker;
  resolvePath?: (importPath: string) => string;
}

const UNRESOLVED_COMPONENT_ERRORS: Record<
  UnresolvedComponentReason,
  { name: string; message: string }
> = {
  'no-meta-component': {
    name: 'No component found',
    message: 'We could not detect the component from your story file. Specify meta.component.',
  },
  'no-component-import': {
    name: 'No component import found',
    message: 'No component file found for the component declared in meta.component.',
  },
};

/**
 * Get last segment of a story title
 */
function componentNameFromTitle(title: string): string {
  return title.split('/').at(-1)!.replace(/\s+/g, '');
}

/**
 * Builds a {@link DocgenPayload} for the component one CSF story file documents.
 */
export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<VueDocgenPayload | undefined> {
  const storyFilePath = getStoryImportPathFromEntry(input.entry);
  if (!storyFilePath) {
    return undefined;
  }

  // Import paths in the index are relative to the project root the server runs from.
  const resolvePath =
    context.resolvePath ?? ((importPath: string) => join(process.cwd(), importPath));
  const storyPath = resolvePath(storyFilePath);

  let storyFile: string;
  try {
    storyFile = await readFile(storyPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // The file backing an indexed entry is gone. Nothing to document, so fall through.
      return undefined;
    }
    throw error;
  }

  // IF the story has no meta.component
  const fallbackName = componentNameFromTitle(input.entry.title);

  const baseFor = (name: string) =>
    ({
      id: getComponentIdFromEntry(input.entry),
      name,
      path: storyFilePath,
      jsDocTags: {},
    }) satisfies Partial<VueDocgenPayload>;

  let csf;
  try {
    csf = loadCsf(storyFile, { makeTitle: () => input.entry.title }).parse();
  } catch (error) {
    return {
      ...baseFor(fallbackName),
      error: {
        name: 'Story file could not be parsed',
        message:
          `${error instanceof Error ? error.message : String(error)}` +
          `\n\n${input.entry.importPath}:\n${storyFile}`,
      },
    };
  }

  const base = baseFor(csf._meta?.component ?? fallbackName);

  const resolved = resolveMetaComponent(csf, storyPath);
  if ('reason' in resolved) {
    const error = UNRESOLVED_COMPONENT_ERRORS[resolved.reason];
    return {
      ...base,
      error: {
        name: error.name,
        message:
          (csf._metaStatementPath?.buildCodeFrameError(error.message).message ?? error.message) +
          `\n\n${input.entry.importPath}:\n${storyFile}`,
      },
    };
  }

  const { component } = resolved;
  const metaSources = await collectComponentMetaSources(
    context.getChecker(component.path),
    component.path
  );
  const componentMeta = metaSources.find((meta) => meta.exportName === component.exportName);

  if (!componentMeta) {
    return {
      ...base,
      error: {
        name: 'No docgen found',
        message: `vue-component-meta extracted no component metadata for the "${component.exportName}" export of ${component.path}.`,
      },
    };
  }

  const { description, summary, jsDocTags } = extractComponentDescription(
    extractDescription(csf._metaStatement) || undefined,
    componentMeta.description
  );

  return {
    ...base,
    description,
    summary,
    jsDocTags,
    vueComponentMeta: componentMeta,
    argTypes: extractArgTypes({ __docgenInfo: componentMeta }) ?? undefined,
  };
}
