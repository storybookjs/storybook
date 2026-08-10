import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { types as t, type NodePath } from 'storybook/internal/babel';
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
  propertyValue,
  resolveRenderFunction,
  returnedObjectExpression,
  storyAssignedArgsPath,
  type ImportBinding,
  type RenderResolution,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';
import type { DocgenPayload, DocgenService } from 'storybook/open-service';

import { importStatementForBinding } from './ast-utils.ts';
import { classifyArgs, type VueDocgenArgInfo } from './classify-args.ts';
import { renderSfcSnippet } from './render-sfc.ts';
import { readTemplateRenderConfig, transformTemplate } from './transform-template.ts';

export interface BuildStoryDocsContext {
  /** Resolve a CSF import path to an absolute file path. Defaults to `process.cwd()` join. */
  resolvePath?: (importPath: string) => string;
  /** Reads docgen for the component id. Defaults to the registered core/docgen service. */
  readDocgen?: (id: string) => Promise<DocgenPayload | undefined>;
}

interface StorySnippetContext {
  componentName: string;
  docgenArgInfo: VueDocgenArgInfo;
}

interface StoryDocsContext {
  /** Present only when the component identifier and docgen data can synthesize snippets. */
  snippet: StorySnippetContext | undefined;
  importBindings: Map<string, ImportBinding>;
  metaPath: NodePath<t.ObjectExpression> | undefined;
  metaArgsError: StoryDoc['error'] | undefined;
  metaArgsPath: ArgsObjectPath | undefined;
}

type ParsedCsf = ReturnType<ReturnType<typeof loadCsf>['parse']>;
type ArgsObjectPath = NodePath<t.ObjectExpression>;
type StoryDocResult = { doc: StoryDoc; imports: string[] };
type ExtractStoriesResult = { stories: Record<string, StoryDoc>; imports: string[] };
type StaticStoryArgs =
  | { kind: 'error'; error: NonNullable<StoryDoc['error']> }
  | { kind: 'classified'; classified: ReturnType<typeof classifyArgs> };

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

  const metaPath = metaObjectPath(csf);
  const id = getComponentIdFromEntry(input.entry);
  let docgenPayload: DocgenPayload | undefined;
  try {
    docgenPayload = await (context.readDocgen ?? readStoredDocgen)(id);
  } catch {
    // Docgen is optional here: without it the payload is still built, just without snippets.
  }
  const componentName = resolveMetaComponentIdentifier(metaPath);
  const importBindings = collectImportBindings(csf._file.path);
  const importStatement = createImportStatement(componentName, importBindings);
  const docgenArgInfo =
    docgenPayload && !docgenPayload.error ? vueDocgenArgInfo(docgenPayload) : undefined;
  const snippet = componentName && docgenArgInfo ? { componentName, docgenArgInfo } : undefined;
  const extracted = extractStories(csf, {
    snippet,
    importBindings,
    metaPath,
    metaArgsError: argsContainerError(metaPath),
    metaArgsPath: argsObjectPathFromObjectPath(metaPath),
  });
  const importCode = Array.from(
    new Set([importStatement, ...extracted.imports].filter((line): line is string => Boolean(line)))
  ).join('\n');

  return {
    id,
    name: componentName ?? docgenPayload?.name ?? fallbackTitle(input.entry.title),
    path: storyFilePath,
    ...(importCode ? { import: importCode } : {}),
    stories: extracted.stories,
  };
}

/** Last title segment matches the fallback used by the existing docgen payload builder. */
function fallbackTitle(title: string): string {
  return title.split('/').at(-1)!.replace(/\s+/g, '');
}

/**
 * Name of the identifier assigned to the meta `component` property, used as payload name,
 * import-binding lookup key, and snippet tag so all three stay coherent.
 *
 * @example `component: MyButton` → `'MyButton'`; `component: UI.Button` → `undefined`
 */
function resolveMetaComponentIdentifier(
  metaPath: NodePath<t.ObjectExpression> | undefined
): string | undefined {
  const value = propertyValue(metaPath?.node, 'component');
  return t.isIdentifier(value) ? value.name : undefined;
}

/**
 * Reconstructs the component's import statement from the story file's import bindings.
 */
function createImportStatement(
  componentName: string | undefined,
  importBindings: Map<string, ImportBinding>
): string | undefined {
  if (!componentName) {
    return undefined;
  }

  const ref = resolveComponentImport(componentName, importBindings);
  return buildImportStatements({ refs: [ref] }).join('\n') || undefined;
}

/**
 * Stored docgen for the component, extracted on demand only when nothing is stored yet.
 */
async function readStoredDocgen(id: string): Promise<DocgenPayload | undefined> {
  const docgen = getService<DocgenService>('core/docgen', { internal: true });
  return docgen.queries.docgen.get({ id }) ?? docgen.queries.docgen.loaded({ id });
}

/**
 * Collects the slot and event names from renderer-converted argTypes.
 */
function vueDocgenArgInfo(payload: DocgenPayload): VueDocgenArgInfo {
  const props = new Set<string>();
  const slots = new Set<string>();
  const events = new Set<string>();

  for (const [name, argType] of Object.entries(payload.argTypes ?? {})) {
    const category = argType.table?.category;
    if (category === 'slots') {
      slots.add(name);
    } else if (category === 'events') {
      events.add(name);
    } else {
      props.add(name);
    }
  }

  return { props, slots, events };
}

/**
 * AST path of the `args` property when its value is an object literal.
 *
 * @example `{ args: { label: 'Hi' } }` → path of `{ label: 'Hi' }`; `{ args: shared }` → undefined
 */
function argsObjectPathFromObjectPath(
  path?: NodePath<t.ObjectExpression>
): ArgsObjectPath | undefined {
  const property = path
    ?.get('properties')
    .find((prop) => prop.isObjectProperty() && keyOf(prop.node) === ARGS_PROPERTY);

  if (!property?.isObjectProperty()) {
    return undefined;
  }

  const value = property.get('value');
  return value.isObjectExpression() ? value : undefined;
}

function argsObjectHasSpread(object: t.ObjectExpression | undefined): boolean {
  return object?.properties.some((property) => property.type === 'SpreadElement') ?? false;
}

/**
 * Maps every CSF story export to its StoryDoc, enriched with a snippet or error where possible.
 */
function extractStories(csf: ParsedCsf, options: StoryDocsContext): ExtractStoriesResult {
  const metaArgs = metaArgsRecord(options.metaPath?.node);
  const imports = new Set<string>();
  const stories = Object.fromEntries(
    Object.entries(csf._stories).map(([storyExport, story]): [string, StoryDoc] => {
      const { description, summary } = extractStoryJSDocInfo(csf._storyStatements[storyExport]);
      const storyDoc: StoryDoc = {
        id: story.id,
        name: story.name ?? storyNameFromExport(storyExport),
        description,
        summary,
      };
      const enriched = enrichStoryDoc(csf, storyExport, storyDoc, metaArgs, options);
      for (const importStatement of enriched.imports) {
        imports.add(importStatement);
      }
      return [story.id, enriched.doc];
    })
  );

  return { imports: Array.from(imports), stories };
}

/**
 * Attaches a synthesized snippet (or an "unsupported args" error) to a story doc.
 */
function enrichStoryDoc(
  csf: ParsedCsf,
  storyExport: string,
  storyDoc: StoryDoc,
  metaArgs: Record<string, t.Node>,
  options: StoryDocsContext
): StoryDocResult {
  if (!options.snippet) {
    return { doc: storyDoc, imports: [] };
  }
  const { componentName, docgenArgInfo } = options.snippet;

  let normalized;
  try {
    normalized = normalizeStoryDeclaration(csf._storyDeclarationPath[storyExport]);
  } catch {
    return { doc: storyDoc, imports: [] };
  }

  if (normalized.type === 'fn') {
    return { doc: storyDoc, imports: [] };
  }

  const storyConfigPath = normalized.type === 'config' ? normalized.path : undefined;
  const effectiveRender = resolveEffectiveRender(
    storyConfigPath,
    options.metaPath,
    csf._storyDeclarationPath[storyExport]
  );
  if (effectiveRender.kind === 'resolved') {
    return enrichStoryDocFromTemplateRender(
      csf,
      storyExport,
      storyDoc,
      effectiveRender.path,
      metaArgs,
      storyConfigPath,
      docgenArgInfo,
      options
    );
  }
  if (effectiveRender.kind === 'unresolved') {
    return { doc: storyDoc, imports: [] };
  }

  const resolved = resolveStaticStoryArgs({
    csf,
    storyExport,
    docgenArgInfo,
    metaArgs,
    metaArgsError: options.metaArgsError,
    metaArgsPath: options.metaArgsPath,
    storyConfigPath,
  });
  if (resolved.kind === 'error') {
    return { doc: { ...storyDoc, error: resolved.error }, imports: [] };
  }

  const classified = resolved.classified;
  if (classified.defer) {
    return { doc: storyDoc, imports: [] };
  }

  return {
    doc: {
      ...storyDoc,
      snippet: renderSfcSnippet({
        componentName,
        args: classified.args,
      }),
      ...(classified.warning ? { warning: classified.warning } : {}),
    },
    imports: [],
  };
}

function enrichStoryDocFromTemplateRender(
  csf: ParsedCsf,
  storyExport: string,
  storyDoc: StoryDoc,
  renderFunction: NodePath<
    t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration
  >,
  metaArgs: Record<string, t.Node>,
  storyConfigPath: NodePath<t.ObjectExpression> | undefined,
  docgenArgInfo: VueDocgenArgInfo,
  options: StoryDocsContext
): StoryDocResult {
  const renderObject = returnedObjectExpression(renderFunction.node);
  const templateConfig = renderObject
    ? readTemplateRenderConfig(renderObject, options.importBindings)
    : undefined;
  if (!templateConfig) {
    return { doc: storyDoc, imports: [] };
  }

  const resolved = resolveStaticStoryArgs({
    csf,
    storyExport,
    docgenArgInfo,
    metaArgs,
    metaArgsError: options.metaArgsError,
    metaArgsPath: options.metaArgsPath,
    storyConfigPath,
  });
  if (resolved.kind === 'error') {
    return { doc: storyDoc, imports: [] };
  }

  const classified = resolved.classified;
  if (classified.defer) {
    return { doc: storyDoc, imports: [] };
  }

  const transformed = transformTemplate({
    args: classified.args,
    componentImports: templateConfig.componentImports,
    template: templateConfig.template,
  });
  if (!transformed) {
    return { doc: storyDoc, imports: [] };
  }

  return {
    doc: {
      ...storyDoc,
      snippet: transformed.snippet,
      ...(classified.warning ? { warning: classified.warning } : {}),
    },
    imports: transformed.imports,
  };
}

function resolveStaticStoryArgs(input: {
  csf: ParsedCsf;
  storyExport: string;
  docgenArgInfo: VueDocgenArgInfo;
  metaArgs: Record<string, t.Node>;
  metaArgsError: StoryDoc['error'] | undefined;
  metaArgsPath: ArgsObjectPath | undefined;
  storyConfigPath: NodePath<t.ObjectExpression> | undefined;
}): StaticStoryArgs {
  const storyArgsError = input.storyConfigPath
    ? argsContainerError(input.storyConfigPath)
    : undefined;
  if (input.metaArgsError || storyArgsError) {
    return { kind: 'error', error: input.metaArgsError ?? storyArgsError! };
  }

  // `Primary.args = { … }` runs after the declaration and replaces its args object outright, so an
  // assignment wins over inline args rather than merging with them.
  const storyArgsPath =
    storyAssignedArgsPath(input.csf._file.path, input.storyExport) ??
    (input.storyConfigPath ? argsObjectPathFromObjectPath(input.storyConfigPath) : undefined);
  if (argsObjectHasSpread(input.metaArgsPath?.node) || argsObjectHasSpread(storyArgsPath?.node)) {
    return {
      kind: 'error',
      error: {
        name: 'Unsupported story args',
        message: 'Story args contain a spread value, which cannot be statically inlined yet.',
      },
    };
  }

  const storyArgs = argsRecordFromObjectPath(storyArgsPath);
  return {
    kind: 'classified',
    classified: classifyArgs(mergeArgsRecords(input.metaArgs, storyArgs), input.docgenArgInfo),
  };
}

function resolveEffectiveRender(
  storyConfigPath: NodePath<t.ObjectExpression> | undefined,
  metaPath: NodePath<t.ObjectExpression> | undefined,
  storyDeclaration: NodePath<t.Node>
): RenderResolution {
  const storyRender = storyConfigPath
    ? resolveRenderFromObjectPath(storyConfigPath, storyDeclaration)
    : { kind: 'missing' as const };
  if (storyRender.kind !== 'missing') {
    return storyRender;
  }

  const metaRender = metaPath
    ? resolveRenderFromObjectPath(metaPath, storyDeclaration)
    : { kind: 'missing' as const };
  return metaRender;
}

function resolveRenderFromObjectPath(
  path: NodePath<t.ObjectExpression>,
  storyDeclaration: NodePath<t.Node>
): RenderResolution {
  try {
    const properties = objectPropertyPaths(path);
    const resolved = resolveRenderFunction(properties, storyDeclaration);
    return resolved.kind === 'missing' &&
      path.node.properties.some((property) => t.isSpreadElement(property))
      ? { kind: 'unresolved' }
      : resolved;
  } catch {
    return { kind: 'unresolved' };
  }
}

function objectPropertyPaths(path: NodePath<t.ObjectExpression>): NodePath<t.ObjectProperty>[] {
  return path
    .get('properties')
    .filter((property): property is NodePath<t.ObjectProperty> => property.isObjectProperty());
}

/**
 * Error for an `args` value that is not an object literal and so cannot be statically inlined.
 *
 * @example `{ args: sharedArgs }` → "Unsupported story args"; `{ args: { a: 1 } }` → undefined
 */
function argsContainerError(path?: NodePath<t.ObjectExpression>): StoryDoc['error'] | undefined {
  const value = propertyValue(path?.node, ARGS_PROPERTY);
  if (!value) {
    return undefined;
  }

  if (t.isObjectExpression(value)) {
    return undefined;
  }

  if (t.isIdentifier(value)) {
    return {
      name: 'Unsupported story args',
      message: `Arg "args" references "${value.name}", which cannot be statically inlined yet.`,
    };
  }

  return {
    name: 'Unsupported story args',
    message: 'Story args must be an object literal to be statically inlined.',
  };
}
