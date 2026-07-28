import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import {
  extractComponentDescription,
  extractDescription,
  loadCsf,
} from 'storybook/internal/csf-tools';
import type { DocgenPayload, DocgenProviderInput } from 'storybook/internal/types';

import { extractArgTypes } from '@storybook/vue3/internal/extract-arg-types';

import type { ComponentMetaChecker } from 'vue-component-meta';

import { type MetaSource, collectComponentMetaSources } from './component-meta.ts';
import { type UnresolvedComponentReason, resolveMetaComponent } from './resolve-component.ts';

export type VueDocgenPayload = DocgenPayload & { vueComponentMeta?: MetaSource };

export interface BuildDocgenContext {
  checker: ComponentMetaChecker;
  /** Resolve a CSF import path to an absolute file path. Defaults to a `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
}

const UNRESOLVED_COMPONENT_ERRORS = new Map<
  UnresolvedComponentReason,
  { name: string; message: string }
>([
  [
    'no-meta-component',
    {
      name: 'No component found',
      message: 'We could not detect the component from your story file. Specify meta.component.',
    },
  ],
  [
    'no-component-import',
    {
      name: 'No component import found',
      message: 'No component file found for the component declared in meta.component.',
    },
  ],
]);

/**
 * Builds a {@link DocgenPayload} for the component one CSF story file documents.
 *
 * Returns `undefined` when the story file cannot be read or parsed, which the provider chain reads as
 * "no docgen here, fall through to the next provider". A story file that parses but names no
 * resolvable component returns a payload carrying the error, matching the React provider — the
 * component exists in the index, so the UI should say why it has no props rather than show nothing.
 *
 * Subcomponents are not extracted yet: `meta.subcomponents` resolution lives in the React renderer's
 * private CSF helpers, and sharing it is a separate change.
 */
export async function buildDocgenPayload(
  input: DocgenProviderInput,
  context: BuildDocgenContext
): Promise<VueDocgenPayload | undefined> {
  const storyFilePath = getStoryImportPathFromEntry(input.entry);
  if (!storyFilePath) {
    return undefined;
  }

  const resolvePath =
    context.resolvePath ?? ((importPath: string) => join(process.cwd(), importPath));
  const storyPath = resolvePath(storyFilePath);

  let csf;
  let storyFile;
  try {
    storyFile = readFileSync(storyPath, 'utf8');
    csf = loadCsf(storyFile, { makeTitle: () => input.entry.title }).parse();
  } catch {
    return undefined;
  }

  const title = input.entry.title.split('/').at(-1)!.replace(/\s+/g, '');
  const base = {
    id: getComponentIdFromEntry(input.entry),
    name: csf._meta?.component ?? title,
    path: storyFilePath,
    jsDocTags: {},
  } satisfies Partial<VueDocgenPayload>;

  const resolved = resolveMetaComponent(csf, storyPath);
  if ('reason' in resolved) {
    const error = UNRESOLVED_COMPONENT_ERRORS.get(resolved.reason)!;
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
  const metaSources = await collectComponentMetaSources(context.checker, component.path);
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
    // UI consumers read `argTypes` so they never have to understand a Vue-specific docgen shape.
    argTypes: extractArgTypes({ __docgenInfo: componentMeta }) ?? undefined,
  };
}
