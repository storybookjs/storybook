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
  buildImportStatements,
  collectImportBindings,
  createStoryArgsResolver,
  createStoryReferenceResolver,
  extractStoryJSDocInfo,
  jsDocTagsForPath,
  keyOf,
  loadCsf,
  metaObjectPath,
  noSnippetWarning,
  normalizeStoryDeclaration,
  propertyValue,
  resolveComponentImport,
  resolveRenderFunction,
  resolveReturnedObjectExpression,
  returnedExpression,
  returnedExpressionPath,
  unresolvedWarning,
  unwrapExpression,
  type ImportBinding,
  type ReferenceContext,
  type RenderFunctionPath,
  type RenderResolution,
  type StoryArgsResolver,
  type StoryReferenceResolver,
} from 'storybook/internal/csf-tools';
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';
import type { DocgenPayload, DocgenService } from 'storybook/open-service';

import { classifyArgs, type ClassifyArgsResult, type VueDocgenArgInfo } from './classify-args.ts';
import type { ForwardableSetup } from './forward-setup.ts';
import { printH } from './print-h.ts';
import { createRenderContext } from './render-primitives.ts';
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
  /** How args follow a reference out of the story file. Defaults to resolving against disk. */
  references?: StoryReferenceResolver;
}

interface StorySnippetContext {
  componentName: string;
  componentImportStatement: string | undefined;
  docgenArgInfo: VueDocgenArgInfo;
}

interface StoryDocsContext {
  /** Present only when the component identifier and docgen data can synthesize snippets. */
  snippet: StorySnippetContext | undefined;
  importBindings: Map<string, ImportBinding>;
  metaPath: NodePath<t.ObjectExpression> | undefined;
  /** Resolves each story's args, following a spread or a name out of the story file. */
  resolver: StoryArgsResolver;
  /** Story file source, for forwarding setup statements verbatim. */
  source: string;
}

// Vue's single-file-component format is tried ahead of the JS/TS extensions, matching how a story
// file resolves an import of a `.vue` module.
const openStoryReferences = createStoryReferenceResolver({ extensions: ['.vue'] });

const RENDER_UNRESOLVED_WARNING =
  'No static snippet: the `render` function could not be resolved statically.';
const SLOT_UNRESOLVED_WARNING =
  'No static snippet: a slot function could not be resolved statically.';
const IMPORT_UNRESOLVED_WARNING =
  "No static snippet: the component's import could not be resolved statically.";
const TEMPLATE_UNRESOLVED_WARNING =
  'No static snippet: the story template could not be resolved statically.';
const UNRENDERED_WARNINGS: Record<Exclude<StaticStoryRenderer, { kind: 'bail' }>['kind'], string> =
  {
    h: RENDER_UNRESOLVED_WARNING,
    sfc: SLOT_UNRESOLVED_WARNING,
    template: TEMPLATE_UNRESOLVED_WARNING,
  };

type ParsedCsf = ReturnType<ReturnType<typeof loadCsf>['parse']>;
type ExtractStoriesResult = { stories: Record<string, StoryDoc> };
type StaticStoryRenderer =
  | { kind: 'bail'; warning: string }
  | { kind: 'h'; argsParam?: string; expression: t.Expression }
  | { kind: 'sfc' }
  | {
      kind: 'template';
      componentImports: TemplateRenderConfig['componentImports'];
      template: string;
      setup?: ForwardableSetup;
    };
type StorySnippetResult = { snippet: string };
type StaticStoryArgs = {
  classified: ClassifyArgsResult;
  /** Source text of everything reading the args statically could not account for. */
  unresolved: string[];
};

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
  const importStatement = createImportStatement(
    componentName,
    importBindings,
    metaPath,
    docgenPayload
  );
  const docgenArgInfo =
    docgenPayload && !docgenPayload.error ? vueDocgenArgInfo(docgenPayload) : undefined;
  const snippet =
    componentName && docgenArgInfo
      ? { componentName, componentImportStatement: importStatement, docgenArgInfo }
      : undefined;
  const extracted = extractStories(csf, {
    snippet,
    importBindings,
    metaPath,
    resolver: createStoryArgsResolver(csf, {
      filePath: storyPath,
      ...(context.references ?? openStoryReferences()),
    }),
    source: storyFile,
  });

  return {
    id,
    name: componentName ?? docgenPayload?.name ?? fallbackTitle(input.entry.title),
    path: storyFilePath,
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
 * Reconstructs the component's import statement from the story file's import bindings, redirected
 * to the source an `@import` tag declares when the story or the component carries one.
 *
 * The CSF `meta` docblock is the supported place to write it, because component-level tags do not
 * survive every docgen backend. A component tag still wins over nothing when one does come through.
 *
 * @example `@import import { Button } from 'my-ds'` above `const meta` for `MyButton` →
 * `import { Button as MyButton } from 'my-ds';`
 */
function createImportStatement(
  componentName: string | undefined,
  importBindings: Map<string, ImportBinding>,
  metaPath: NodePath<t.ObjectExpression> | undefined,
  docgenPayload: DocgenPayload | undefined
): string | undefined {
  if (!componentName) {
    return undefined;
  }

  // The override supplies the source and specifier kind, but the local name has to stay the one the
  // snippet renders, so the statement and the snippet keep referring to the same identifier.
  const ref = resolveComponentImport(componentName, importBindings);
  const importOverride =
    jsDocTagsForPath(metaPath).import?.[0] ?? docgenPayload?.jsDocTags.import?.[0];
  return buildImportStatements({ refs: [{ ...ref, importOverride }] }).join('\n') || undefined;
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
 * Maps every CSF story export to its StoryDoc, enriched with a snippet or error where possible.
 */
function extractStories(csf: ParsedCsf, options: StoryDocsContext): ExtractStoriesResult {
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
      return [story.id, enriched];
    })
  );

  return { stories };
}

/**
 * Attaches a synthesized snippet to a story doc, or a standalone `warning` saying why none could
 * be produced.
 *
 * The runtime source decorator still renders an exact snippet in the browser, but payload
 * consumers that never run the story (manifests, agents) would otherwise see nothing at all, so
 * every statically unresolvable story names what could not be read instead of staying silent.
 * Only stories outside the provider's scope (CSF2 function stories, unreadable declarations,
 * missing docgen) stay unmarked.
 */
function enrichStoryDoc(
  csf: ParsedCsf,
  storyExport: string,
  storyDoc: StoryDoc,
  options: StoryDocsContext
): StoryDoc {
  const plain = storyDoc;
  const withWarning = (warning: string | undefined): StoryDoc =>
    warning ? { ...storyDoc, warning } : plain;

  if (!options.snippet) {
    return plain;
  }
  const { componentName, componentImportStatement, docgenArgInfo } = options.snippet;

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
    csf._storyDeclarationPath[storyExport],
    options.resolver.ctx
  );
  const renderer =
    effectiveRender.kind === 'resolved'
      ? staticRendererForRenderFunction(effectiveRender.path, options)
      : effectiveRender.kind === 'missing'
        ? { kind: 'sfc' as const }
        : undefined;
  if (!renderer) {
    return withWarning(RENDER_UNRESOLVED_WARNING);
  }
  if (renderer.kind === 'bail') {
    return withWarning(renderer.warning);
  }

  // The SFC renderer needs the component's import statement; without one, the bail below would
  // otherwise blame a slot that was never involved.
  if (renderer.kind === 'sfc' && !componentImportStatement) {
    return withWarning(IMPORT_UNRESOLVED_WARNING);
  }

  const resolved = resolveStaticStoryArgs(storyExport, docgenArgInfo, options);
  const { classified } = resolved;
  const { args, unresolved: classifyUnresolved } = classified;
  const unresolved = [...classifyUnresolved, ...resolved.unresolved];

  // A snippet showing none of the args the story actually sets would be a worse example than the
  // runtime one, so no snippet is emitted and the warning names everything that was dropped.
  if (args.length === 0 && unresolved.length > 0) {
    return withWarning(noSnippetWarning(unresolved));
  }

  const rendered = renderStaticStorySnippet(
    renderer,
    classified,
    componentName,
    docgenArgInfo,
    options
  );
  if (!rendered) {
    return withWarning(UNRENDERED_WARNINGS[renderer.kind]);
  }

  return {
    ...storyDoc,
    snippet: rendered.snippet,
    ...(unresolved.length > 0 ? { warning: unresolvedWarning(unresolved) } : {}),
  };
}

function staticRendererForRenderFunction(
  renderFunction: RenderFunctionPath,
  options: StoryDocsContext
): StaticStoryRenderer | undefined {
  const renderObject = resolveReturnedObjectExpression(renderFunction);
  if (renderObject) {
    const resolution = readTemplateRenderConfig(renderObject, options.importBindings, {
      argsParam: argsParameterName(renderFunction.node),
      componentImportStatement: options.snippet?.componentImportStatement,
      componentName: options.snippet?.componentName,
      source: options.source,
    });
    if (resolution.kind === 'bail') {
      return { kind: 'bail', warning: resolution.warning };
    }
    if (resolution.kind === 'config') {
      return { kind: 'template', ...resolution.config };
    }

    const setupExpression = setupReturnedRenderExpression(renderObject);
    if (setupExpression) {
      return {
        argsParam: argsParameterName(renderFunction.node),
        expression: setupExpression,
        kind: 'h',
      };
    }
  }

  const hExpression = returnedExpressionPath(renderFunction)?.node;
  return hExpression
    ? {
        argsParam: argsParameterName(renderFunction.node),
        expression: hExpression,
        kind: 'h',
      }
    : undefined;
}

function resolveStaticStoryArgs(
  storyExport: string,
  docgenArgInfo: VueDocgenArgInfo,
  options: StoryDocsContext
): StaticStoryArgs {
  // A name another module owns stays as written, for the classifier to report.
  const resolved = options.resolver.resolve(storyExport);
  return {
    classified: classifyArgs(resolved.args, docgenArgInfo),
    unresolved: resolved.unresolved,
  };
}

function renderStaticStorySnippet(
  renderer: Exclude<StaticStoryRenderer, { kind: 'bail' }>,
  classified: ClassifyArgsResult,
  componentName: string,
  docgenArgInfo: VueDocgenArgInfo,
  options: StoryDocsContext
): StorySnippetResult | undefined {
  const componentImportStatement = options.snippet?.componentImportStatement;
  const { args } = classified;

  // A story without a render function shows the component receiving the args directly.
  if (renderer.kind === 'sfc') {
    return componentImportStatement
      ? transformTemplate({
          args,
          componentImports: new Map([[componentName, componentImportStatement]]),
          componentName,
          importBindings: options.importBindings,
          template: `<${componentName} v-bind="args" />`,
          unsetArgs: classified.unset,
        })
      : undefined;
  }

  if (renderer.kind === 'template') {
    return transformTemplate({
      args,
      componentImports: renderer.componentImports,
      componentName,
      importBindings: options.importBindings,
      setup: renderer.setup,
      template: renderer.template,
      unsetArgs: classified.unset,
    });
  }

  const ctx = createRenderContext();
  const printed = printH({
    argsParam: renderer.argsParam,
    componentImportStatement,
    componentName,
    ctx,
    docgen: docgenArgInfo,
    importBindings: options.importBindings,
    node: renderer.expression,
  });
  if (!printed) {
    return undefined;
  }

  return transformTemplate({
    args,
    componentImports: printed.componentImports,
    componentName,
    ctx,
    importBindings: options.importBindings,
    template: printed.template,
    unsetArgs: classified.unset,
  });
}

/**
 * The `h()` tree a render object's `setup` returns through its render closure, when nothing else
 * on the object can change what the story renders.
 *
 * @example `render: (args) => ({ setup: () => () => h(C, { label: args.label }) })` -> the `h(...)` call
 */
function setupReturnedRenderExpression(renderObject: t.ObjectExpression): t.Expression | undefined {
  const supported = renderObject.properties.every((property) => {
    if (t.isSpreadElement(property)) {
      return false;
    }
    const key = keyOf(property);
    return key === 'setup' || key === 'components' || key === 'inheritAttrs';
  });
  if (!supported) {
    return undefined;
  }

  const setup = renderObject.properties.find(
    (property) => !t.isSpreadElement(property) && keyOf(property) === 'setup'
  );
  const setupFn = t.isObjectMethod(setup)
    ? setup
    : t.isObjectProperty(setup)
      ? unwrapExpression(setup.value)
      : undefined;
  if (!setupFn || !t.isFunction(setupFn)) {
    return undefined;
  }

  const renderClosure = returnedExpression(setupFn);
  const closure = renderClosure && unwrapExpression(renderClosure);
  // A render closure with parameters would receive values the snippet cannot reproduce.
  if (!closure || !t.isFunction(closure) || closure.params.length > 0) {
    return undefined;
  }

  return returnedExpression(closure);
}

function argsParameterName(renderFunction: RenderFunctionPath['node']): string | undefined {
  const [parameter] = renderFunction.params;
  return t.isIdentifier(parameter) ? parameter.name : undefined;
}

function resolveEffectiveRender(
  storyConfigPath: NodePath<t.ObjectExpression> | undefined,
  metaPath: NodePath<t.ObjectExpression> | undefined,
  storyDeclaration: NodePath<t.Node>,
  references: ReferenceContext
): RenderResolution {
  const storyRender = resolveRenderFromObjectPath(storyConfigPath, storyDeclaration, references);
  return storyRender.kind !== 'missing'
    ? storyRender
    : resolveRenderFromObjectPath(metaPath, storyDeclaration, references);
}

function resolveRenderFromObjectPath(
  path: NodePath<t.ObjectExpression> | undefined,
  storyDeclaration: NodePath<t.Node>,
  references: ReferenceContext
): RenderResolution {
  try {
    return resolveRenderFunction(path, storyDeclaration, references);
  } catch {
    return { kind: 'unresolved' };
  }
}
