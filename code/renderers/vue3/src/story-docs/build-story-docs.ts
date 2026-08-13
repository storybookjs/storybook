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
  metaObjectPath,
  normalizeStoryDeclaration,
  propertyValue,
  resolveComponentImport,
  resolveRenderFunction,
  returnedObjectExpression,
  storyAssignedArgsPath,
  type ImportBinding,
  type RenderFunctionPath,
  type RenderResolution,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';
import type { DocgenPayload, DocgenService } from 'storybook/open-service';

import { classifyArgs, type ClassifiedArg, type VueDocgenArgInfo } from './classify-args.ts';
import { renderSfcSnippet } from './render-sfc.ts';
import {
  readTemplateRenderConfig,
  transformTemplate,
  type TemplateRenderConfig,
} from './transform-template.ts';

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
}

type ParsedCsf = ReturnType<ReturnType<typeof loadCsf>['parse']>;
type ArgsObjectPath = NodePath<t.ObjectExpression>;
type StoryDocResult = { doc: StoryDoc; imports: string[] };
type ExtractStoriesResult = { stories: Record<string, StoryDoc>; imports: string[] };
type StaticStoryRenderer =
  | { kind: 'sfc' }
  | {
      kind: 'template';
      componentImports: TemplateRenderConfig['componentImports'];
      template: string;
    };
type StorySnippetResult = { snippet: string; imports: string[] };
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
  const extracted = extractStories(csf, { snippet, importBindings, metaPath });
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
      const enriched = enrichStoryDoc(csf, storyExport, storyDoc, options);
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
  options: StoryDocsContext
): StoryDocResult {
  const plain: StoryDocResult = { doc: storyDoc, imports: [] };

  if (!options.snippet) {
    return plain;
  }
  const { componentName, docgenArgInfo } = options.snippet;

  let normalized;
  try {
    normalized = normalizeStoryDeclaration(csf._storyDeclarationPath[storyExport]);
  } catch {
    return plain;
  }

  if (normalized.type === 'fn') {
    return plain;
  }

  const storyConfigPath = normalized.type === 'config' ? normalized.path : undefined;
  const effectiveRender = resolveEffectiveRender(
    storyConfigPath,
    options.metaPath,
    csf._storyDeclarationPath[storyExport]
  );
  const renderer =
    effectiveRender.kind === 'resolved'
      ? staticRendererForRenderFunction(effectiveRender.path, options)
      : effectiveRender.kind === 'missing'
        ? { kind: 'sfc' as const }
        : undefined;
  if (!renderer) {
    return plain;
  }

  const resolved = resolveStaticStoryArgs(
    csf,
    storyExport,
    docgenArgInfo,
    options.metaPath,
    storyConfigPath
  );
  if (resolved.kind === 'error') {
    // Only the SFC path reports arg errors; render-function stories defer to runtime source.
    return renderer.kind === 'sfc'
      ? { doc: { ...storyDoc, error: resolved.error }, imports: [] }
      : plain;
  }

  const classified = resolved.classified;
  if (classified.defer) {
    return plain;
  }

  const rendered = renderStaticStorySnippet(renderer, classified.args, componentName);
  if (!rendered) {
    return plain;
  }

  return {
    doc: {
      ...storyDoc,
      snippet: rendered.snippet,
      ...(classified.warning ? { warning: classified.warning } : {}),
    },
    imports: rendered.imports,
  };
}

function staticRendererForRenderFunction(
  renderFunction: RenderFunctionPath,
  options: StoryDocsContext
): StaticStoryRenderer | undefined {
  const renderObject = returnedObjectExpression(renderFunction.node);
  const templateConfig = renderObject
    ? readTemplateRenderConfig(renderObject, options.importBindings)
    : undefined;
  return templateConfig ? { kind: 'template', ...templateConfig } : undefined;
}

function renderStaticStorySnippet(
  renderer: StaticStoryRenderer,
  args: ClassifiedArg[],
  componentName: string
): StorySnippetResult | undefined {
  if (renderer.kind === 'sfc') {
    return { imports: [], snippet: renderSfcSnippet({ args, componentName }) };
  }

  return transformTemplate({
    args,
    componentImports: renderer.componentImports,
    template: renderer.template,
  });
}

function resolveStaticStoryArgs(
  csf: ParsedCsf,
  storyExport: string,
  docgenArgInfo: VueDocgenArgInfo,
  metaPath: NodePath<t.ObjectExpression> | undefined,
  storyConfigPath: NodePath<t.ObjectExpression> | undefined
): StaticStoryArgs {
  const argsError = argsContainerError(metaPath) ?? argsContainerError(storyConfigPath);
  if (argsError) {
    return { kind: 'error', error: argsError };
  }

  const metaArgsPath = argsObjectPathFromObjectPath(metaPath);
  // `Primary.args = { … }` runs after the declaration and replaces its args object outright, so an
  // assignment wins over inline args rather than merging with them.
  const storyArgsPath =
    storyAssignedArgsPath(csf._file.path, storyExport) ??
    argsObjectPathFromObjectPath(storyConfigPath);
  if (argsObjectHasSpread(metaArgsPath?.node) || argsObjectHasSpread(storyArgsPath?.node)) {
    return {
      kind: 'error',
      error: {
        name: 'Unsupported story args',
        message: 'Story args contain a spread value, which cannot be statically inlined yet.',
      },
    };
  }

  return {
    kind: 'classified',
    classified: classifyArgs(
      mergeArgsRecords(
        argsRecordFromObjectPath(metaArgsPath),
        argsRecordFromObjectPath(storyArgsPath)
      ),
      docgenArgInfo
    ),
  };
}

function resolveEffectiveRender(
  storyConfigPath: NodePath<t.ObjectExpression> | undefined,
  metaPath: NodePath<t.ObjectExpression> | undefined,
  storyDeclaration: NodePath<t.Node>
): RenderResolution {
  const storyRender = resolveRenderFromObjectPath(storyConfigPath, storyDeclaration);
  return storyRender.kind !== 'missing'
    ? storyRender
    : resolveRenderFromObjectPath(metaPath, storyDeclaration);
}

function resolveRenderFromObjectPath(
  path: NodePath<t.ObjectExpression> | undefined,
  storyDeclaration: NodePath<t.Node>
): RenderResolution {
  try {
    return resolveRenderFunction(path, storyDeclaration);
  } catch {
    return { kind: 'unresolved' };
  }
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
