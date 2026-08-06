import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { type NodePath, type types as t } from 'storybook/internal/babel';
import {
  STORY_FILE_TEST_REGEXP,
  getComponentIdFromEntry,
  getStoryImportPathFromEntry,
} from 'storybook/internal/common';
import { getService } from 'storybook/internal/core-server';
import { storyNameFromExport } from 'storybook/internal/csf';
import {
  argsRecordFromObjectPath,
  buildImportStatements,
  collectImportBindings,
  extractStoryJSDocInfo,
  keyOf,
  loadCsf,
  mergeArgsRecords,
  metaArgsRecord,
  metaObjectPath,
  normalizeStoryDeclaration,
  resolveComponentImport,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';
import type { DocgenPayload, DocgenService } from 'storybook/open-service';

import { classifyArgs, type VueDocgenArgInfo } from './classify-args.ts';
import { renderSfcSnippet } from './render-sfc.ts';

export interface BuildStoryDocsContext {
  /** Resolve a CSF import path to an absolute file path. Defaults to `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
  /** Reads fresh docgen for the component id. Defaults to the registered core/docgen service. */
  readDocgen?: (id: string) => Promise<DocgenPayload | undefined>;
}

type ParsedCsf = ReturnType<ReturnType<typeof loadCsf>['parse']>;
type ArgsObjectPath = NodePath<t.ObjectExpression> | undefined;

const COMPONENT_PROPERTY = 'component';
const ARGS_PROPERTY = 'args';

/**
 * Builds Vue story-docs metadata without snippets so runtime source fallback remains authoritative.
 */
export async function buildStoryDocsPayload(
  input: StoryDocsProviderInput,
  context: BuildStoryDocsContext = {}
): Promise<StoryDocsPayload | undefined> {
  const storyFilePath = getStoryImportPathFromEntry(input.entry);
  if (!storyFilePath || !STORY_FILE_TEST_REGEXP.test(storyFilePath)) {
    return undefined;
  }

  const resolvePath =
    context.resolvePath ??
    ((importPath: string): string =>
      isAbsolute(importPath) ? importPath : join(process.cwd(), importPath));
  const storyPath = resolvePath(storyFilePath);

  let storyFile: string;
  try {
    storyFile = await readFile(storyPath, 'utf8');
  } catch {
    return undefined;
  }

  let csf: ParsedCsf;
  try {
    csf = loadCsf(storyFile, { makeTitle: () => input.entry.title }).parse();
  } catch {
    return undefined;
  }

  const id = getComponentIdFromEntry(input.entry);
  const docgenPayload = await readFreshDocgen(id, context.readDocgen);
  const componentName = resolveMetaComponentIdentifier(csf);
  const importStatement = createImportStatement(csf);
  const docgenArgInfo =
    docgenPayload && !docgenPayload.error ? vueDocgenArgInfo(docgenPayload) : undefined;

  return {
    id,
    name: componentName ?? docgenPayload?.name ?? fallbackTitle(input.entry.title),
    path: storyFilePath,
    ...(importStatement ? { import: importStatement } : {}),
    stories: extractStories(csf, {
      componentName,
      docgenArgInfo,
      metaArgsError: argsContainerError(metaObjectPath(csf)),
      metaArgsPath: metaArgsObjectPath(csf),
    }),
  };
}

/** Last title segment matches the fallback used by the existing docgen payload builder. */
function fallbackTitle(title: string): string {
  return title.split('/').at(-1)!.replace(/\s+/g, '');
}

function resolveMetaComponentIdentifier(csf: ParsedCsf): string | undefined {
  const metaPath = metaObjectPath(csf);
  const componentProperty = metaPath
    ?.get('properties')
    .find((property) => property.isObjectProperty() && keyOf(property.node) === COMPONENT_PROPERTY);

  if (!componentProperty?.isObjectProperty()) {
    return undefined;
  }

  const value = componentProperty.get('value');
  return value.isIdentifier() ? value.node.name : undefined;
}

function createImportStatement(csf: ParsedCsf): string | undefined {
  const componentName = resolveMetaComponentIdentifier(csf);
  if (!componentName) {
    return undefined;
  }

  const ref = resolveComponentImport(componentName, collectImportBindings(csf._file.path));
  return buildImportStatements({ refs: [ref] }).join('\n') || undefined;
}

async function readFreshDocgen(
  id: string,
  readDocgen = readDocgenFromService
): Promise<DocgenPayload | undefined> {
  try {
    return await readDocgen(id);
  } catch {
    return undefined;
  }
}

async function readDocgenFromService(id: string): Promise<DocgenPayload | undefined> {
  const docgen = getService<DocgenService>('core/docgen', { internal: true });
  return docgen.commands.extractDocgen({ id });
}

function vueDocgenArgInfo(payload: DocgenPayload): VueDocgenArgInfo {
  const slots = new Set<string>();
  const events = new Set<string>();
  const vueComponentMeta = payload.vueComponentMeta;

  if (isVueComponentMeta(vueComponentMeta)) {
    for (const slot of vueComponentMeta.slots) {
      if (typeof slot.name === 'string') {
        slots.add(slot.name);
      }
    }
    for (const event of vueComponentMeta.events) {
      if (typeof event.name === 'string') {
        events.add(event.name);
      }
    }
  }

  for (const [name, argType] of Object.entries(payload.argTypes ?? {})) {
    const category = argType.table?.category;
    if (category === 'slots') {
      slots.add(name);
    } else if (category === 'events') {
      events.add(name);
    }
  }

  return { slots, events };
}

function isVueComponentMeta(
  value: unknown
): value is { slots: Array<{ name?: unknown }>; events: Array<{ name?: unknown }> } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { slots?: unknown }).slots) &&
    Array.isArray((value as { events?: unknown }).events)
  );
}

function metaArgsObjectPath(csf: ParsedCsf): ArgsObjectPath {
  return argsObjectPathFromObjectPath(metaObjectPath(csf));
}

function argsObjectPathFromObjectPath(path?: NodePath<t.ObjectExpression>): ArgsObjectPath {
  const property = path
    ?.get('properties')
    .find((prop) => prop.isObjectProperty() && keyOf(prop.node) === ARGS_PROPERTY);

  if (!property?.isObjectProperty()) {
    return undefined;
  }

  const value = property.get('value');
  return value.isObjectExpression() ? value : undefined;
}

function argsObjectHasSpread(path: ArgsObjectPath): boolean {
  return path?.node.properties.some((property) => property.type === 'SpreadElement') ?? false;
}

function extractStories(
  csf: ParsedCsf,
  options: {
    componentName?: string;
    docgenArgInfo?: VueDocgenArgInfo;
    metaArgsError?: StoryDoc['error'];
    metaArgsPath: ArgsObjectPath;
  }
): Record<string, StoryDoc> {
  const metaArgs = metaArgsRecord(metaObjectPath(csf)?.node);

  return Object.fromEntries(
    Object.entries(csf._stories).map(([storyExport, story]): [string, StoryDoc] => {
      const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[storyExport]);
      const storyDoc: StoryDoc = {
        id: story.id,
        name: story.name ?? storyNameFromExport(storyExport),
        description,
        summary,
      };
      return [story.id, enrichStoryDoc(csf, storyExport, storyDoc, metaArgs, options)];
    })
  );
}

function enrichStoryDoc(
  csf: ParsedCsf,
  storyExport: string,
  storyDoc: StoryDoc,
  metaArgs: Record<string, t.Node>,
  options: {
    componentName?: string;
    docgenArgInfo?: VueDocgenArgInfo;
    metaArgsError?: StoryDoc['error'];
    metaArgsPath: ArgsObjectPath;
  }
): StoryDoc {
  if (!options.componentName || !options.docgenArgInfo) {
    return storyDoc;
  }

  let normalized;
  try {
    normalized = normalizeStoryDeclaration(csf._storyDeclarationPath[storyExport]);
  } catch {
    return storyDoc;
  }

  if (normalized.type === 'fn') {
    return storyDoc;
  }

  const storyArgsError =
    normalized.type === 'config' ? argsContainerError(normalized.path) : undefined;
  if (options.metaArgsError || storyArgsError) {
    return { ...storyDoc, error: options.metaArgsError ?? storyArgsError };
  }

  const storyArgsPath =
    normalized.type === 'config' ? argsObjectPathFromObjectPath(normalized.path) : undefined;
  if (argsObjectHasSpread(options.metaArgsPath) || argsObjectHasSpread(storyArgsPath)) {
    return {
      ...storyDoc,
      error: {
        name: 'Unsupported story args',
        message: 'Story args contain a spread value, which cannot be statically inlined yet.',
      },
    };
  }

  const storyArgs = normalized.type === 'config' ? argsRecordFromObjectPath(storyArgsPath) : {};
  const classified = classifyArgs(mergeArgsRecords(metaArgs, storyArgs), options.docgenArgInfo);
  if (classified.skipSnippet) {
    return storyDoc;
  }
  if (classified.error) {
    return { ...storyDoc, error: classified.error };
  }

  return {
    ...storyDoc,
    snippet: renderSfcSnippet({
      componentName: options.componentName,
      args: classified.args,
    }),
  };
}

function argsContainerError(path?: NodePath<t.ObjectExpression>): StoryDoc['error'] | undefined {
  const property = path
    ?.get('properties')
    .find((prop) => prop.isObjectProperty() && keyOf(prop.node) === ARGS_PROPERTY);

  if (!property?.isObjectProperty()) {
    return undefined;
  }

  const value = property.get('value');
  if (value.isObjectExpression()) {
    return undefined;
  }

  if (value.isIdentifier()) {
    return {
      name: 'Unsupported story args',
      message: `Arg "args" references "${value.node.name}", which cannot be statically inlined yet.`,
    };
  }

  return {
    name: 'Unsupported story args',
    message: 'Story args must be an object literal to be statically inlined.',
  };
}
