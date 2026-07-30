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

export type VueDocgenPayload = DocgenPayload & { vueComponentMeta?: MetaSource };

export interface BuildDocgenContext {
  getChecker: (componentFilePath: string) => ComponentMetaChecker;
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
 * Returns `undefined` only when there is nothing to document — no story file on the entry, or the
 * file is gone from disk — which the provider chain reads as "fall through to the next provider".
 * Every other failure returns a payload carrying the error, matching the React provider: the
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

  // Read from disk rather than from a cache: the docgen service re-extracts a component when its
  // sources change, and one story file backs one component id, so a cache would only add a
  // staleness surface. Async so concurrent extractions (the service fans out over the index) are
  // not serialized on the worker thread.
  let storyFile: string;
  try {
    storyFile = await readFile(storyPath, 'utf8');
  } catch {
    // The file backing an indexed entry is gone. Nothing to document, so fall through.
    return undefined;
  }

  const title = input.entry.title.split('/').at(-1)!.replace(/\s+/g, '');
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
    // The indexer already parsed this file with the same loader to produce the entry, so failing
    // here means a version skew or a bug on our side. Report it instead of returning undefined,
    // which the chain reads as "no docgen here" and would surface as an unexplained empty panel.
    return {
      ...baseFor(title),
      error: {
        name: 'Story file could not be parsed',
        message:
          `${error instanceof Error ? error.message : String(error)}` +
          `\n\n${input.entry.importPath}:\n${storyFile}`,
      },
    };
  }

  // `meta.component` is the component's local identifier in the story file — a better name than the
  // title segment whenever it is available.
  const base = baseFor(csf._meta?.component ?? title);

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
