import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import {
  extractComponentDescription,
  extractDescription,
  loadCsf,
} from 'storybook/internal/csf-tools';
import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';

import type ts from 'typescript';

import { extractArgTypes } from '../extractArgTypes.ts';

import type { ComponentMetaChecker } from 'vue-component-meta';

import { buildApiDescription } from './api-description.ts';
import { type MetaSource, collectComponentMetaSources } from './component-meta.ts';
import { followReExport } from './follow-re-export.ts';
import { type UnresolvedComponentReason, resolveMetaComponent } from './resolve-component.ts';

type VueDocgenPayload = DocgenPayload & { vueComponentMeta?: MetaSource };

const META_COMPONENT_NAME = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
const NON_COMPONENT_NAMES = new Set([
  'null',
  'undefined',
  'true',
  'false',
  'NaN',
  'Infinity',
  'this',
  'import',
]);

export interface BuildDocgenContext {
  getChecker: (componentFilePath: string) => ComponentMetaChecker;
  resolvePath?: (importPath: string) => string;
  typescript: typeof ts;
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
  'unreadable-component-expression': {
    name: 'No component found',
    message:
      'We could not follow meta.component to a component. Storybook follows an imported name, a namespace-import property access, or a chain of property accesses and spreads through modules it can resolve.',
  },
};

/**
 * Get last segment of a story title
 */
function componentNameFromTitle(title: string): string {
  return title.split('/').at(-1)!.replace(/\s+/g, '');
}

function getUsableComponentName(component: string | undefined): string | undefined {
  const name = component?.trim();
  if (!name || NON_COMPONENT_NAMES.has(name.split('.')[0]!) || !META_COMPONENT_NAME.test(name)) {
    return undefined;
  }
  return name;
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

  const authoredComponentName = getUsableComponentName(csf._meta?.component);
  const base = baseFor(authoredComponentName ?? fallbackName);

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
  const checker = context.getChecker(component.path);
  // Resolving the barrel first also means the event-description pass reads the declaring SFC rather
  // than the index file, which has no component in it to read descriptions from.
  const declared = followReExport(checker, component.path, component.exportName) ?? {
    path: component.path,
    exportName: component.exportName,
  };
  const metaSources = await collectComponentMetaSources(checker, declared.path, context.typescript);
  const componentMeta = metaSources.find((meta) => meta.exportName === declared.exportName);

  if (!componentMeta) {
    return {
      ...base,
      error: {
        name: 'No docgen found',
        message: `vue-component-meta extracted no component metadata for the "${declared.exportName}" export of ${declared.path}.`,
      },
    };
  }

  const metaJsDoc = extractDescription(csf._metaStatement) || undefined;
  const { description, summary, jsDocTags } = extractComponentDescription(
    metaJsDoc,
    componentMeta.description,
    componentMeta.jsDocTags
  );

  return {
    ...baseFor((authoredComponentName ?? componentMeta.displayName) || fallbackName),
    description,
    summary,
    jsDocTags,
    vueComponentMeta: componentMeta,
    argTypes: extractArgTypes({ __docgenInfo: componentMeta }) ?? undefined,
    apiDescription: buildApiDescription(componentMeta),
    renderer: 'vue3',
  };
}
