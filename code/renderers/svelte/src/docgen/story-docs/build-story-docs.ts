import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { storyNameFromExport, toId } from 'storybook/internal/csf';
import {
  type ESTreeNode as Node,
  type ImportBinding,
  type ResolvedStoryArgs,
  collectImportBindings,
  createStoryArgsResolver,
  createStoryReferenceResolver,
  extractStoryJSDocInfo,
  jsDocTagsForNode,
  loadCsf,
  metaObject,
  propertyValue,
  returnedExpression,
  staticKey,
  textOf,
  unresolvedWarning,
  unwrapExpression,
} from 'storybook/internal/csf-tools';
import { hasHoleBracket, writtenArg } from 'storybook/internal/docs-tools';
import type {
  Args,
  StoryDoc,
  StoryDocsPayload,
  StoryDocsProviderInput,
} from 'storybook/internal/types';

import { printTemplate } from './print-template.ts';
import { buildSnippetImportBlock } from './snippet-imports.ts';
import { type StoryFile, readSvelteCsfFile } from './svelte-csf-file.ts';

const openStoryReferences = createStoryReferenceResolver({ extensions: ['.svelte'] });

const RENDER_WARNING = 'The render function is not reflected in this snippet.';

export async function buildStoryDocsPayload(
  input: StoryDocsProviderInput,
  // For tests: the args each story is written with, as the preview fills its template with them.
  { onStoryArgs }: { onStoryArgs?: (id: string, args: Args) => void } = {}
): Promise<StoryDocsPayload | undefined> {
  const path = getStoryImportPathFromEntry(input.entry);
  if (!path) return undefined;
  const filename = resolve(path);
  const source = await readFile(filename, 'utf8');
  const svelte = filename.endsWith('.svelte');
  const file: StoryFile = svelte
    ? await readSvelteCsfFile(source, filename)
    : {
        csfSource: source,
        typescript: /\.[cm]?tsx?$/.test(filename),
        stories: new Map(),
        snippets: new Map(),
        moduleScript: source,
      };
  const csf = loadCsf(file.csfSource, {
    makeTitle: () => input.entry.title,
    fileName: svelte ? `${filename}.${file.typescript ? 'ts' : 'js'}` : filename,
  }).parse();
  const meta = metaObject(csf);
  const component = propertyValue(meta, 'component');
  const componentName =
    component && /^[A-Z][\w$]*(?:\.[\w$]+)*$/.test(textOf(component))
      ? textOf(component)
      : undefined;
  const importStatement = meta ? jsDocTagsForNode(meta, csf.editor).import?.[0] : undefined;
  const context: StoryContext = {
    file,
    bindings: collectImportBindings(csf.program),
    importOverride:
      componentName && importStatement
        ? { name: componentName, statement: importStatement }
        : undefined,
    componentName: svelte ? undefined : componentName,
  };
  const resolver = createStoryArgsResolver(csf, { filePath: filename, ...openStoryReferences() });

  const stories: Record<string, StoryDoc> = {};
  for (const [exportName, story] of Object.entries(csf._stories)) {
    const id = svelte
      ? toId(csf.meta.id ?? csf.meta.title ?? input.entry.title, storyNameFromExport(exportName))
      : story.id;
    const doc: StoryDoc = {
      id,
      name: story.name ?? storyNameFromExport(exportName),
      ...extractStoryJSDocInfo(csf._storyStatements[exportName], csf.editor),
      ...(file.stories.get(exportName)?.description
        ? { description: file.stories.get(exportName)!.description }
        : {}),
    };
    try {
      const resolved = resolver.resolve(exportName);
      stories[id] = { ...doc, ...storySnippet(exportName, resolved, context) };
      onStoryArgs?.(id, ownArgs(resolved.args));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stories[id] = { ...doc, warning: `No static snippet: ${message}` };
    }
  }
  return {
    id: getComponentIdFromEntry(input.entry),
    name: componentName ?? input.entry.title.split('/').at(-1)!,
    path,
    stories,
  };
}

interface StoryContext {
  file: StoryFile;
  bindings: Map<string, ImportBinding>;
  importOverride?: { name: string; statement: string };
  // The meta component of a plain CSF file, which renders the args of a story without markup.
  componentName?: string;
}

function storySnippet(
  exportName: string,
  resolved: ResolvedStoryArgs,
  { file, bindings, importOverride, componentName }: StoryContext
): Pick<StoryDoc, 'snippet' | 'warning' | 'template' | 'argCode'> {
  const story = file.stories.get(exportName);
  const template =
    story?.template ?? (componentName ? `<${componentName} {...args} />` : undefined);
  const renders =
    !story?.template &&
    (resolved.storyMembers.properties.render || resolved.metaMembers.properties.render);
  if (!template) return renders ? { warning: RENDER_WARNING } : {};

  const snippets: Record<string, string> = {};
  for (const [key, node] of Object.entries(resolved.args)) {
    const snippet = snippetArg(key, node, file, bindings);
    if (snippet !== undefined) snippets[key] = snippet;
  }

  const print = (holes: boolean) =>
    printTemplate({
      code: template,
      args: resolved.args,
      typescript: file.typescript,
      parameter: story?.parameter,
      snippets,
      argsComplete: resolved.unresolved.length === 0,
      holes,
    });
  let markup = print(false);
  // The same markup with a hole wherever it prints an arg's value, which the preview fills with
  // the current args; code that already holds a hole bracket has no template.
  let holes = hasHoleBracket(template) ? undefined : print(true);
  const importBlock = () =>
    buildSnippetImportBlock(markup, {
      bindings,
      importOverride,
      instanceScript: file.instanceScript,
      moduleScript: file.moduleScript,
      imports: resolved.imports.filter(
        (ref) => !ref.localImportName || !bindings.has(ref.localImportName)
      ),
      typescript: file.typescript,
    });
  // Declare the snippets of the story file that the markup reads, and the ones they read.
  let imported = importBlock();
  const declared = new Set<string>();
  for (;;) {
    const missing = (imported.unresolvedIdentifiers ?? []).filter(
      (name) => file.snippets.has(name) && !declared.has(name)
    );
    if (!missing.length) break;
    for (const name of missing) {
      declared.add(name);
      const { parameters, body } = file.snippets.get(name)!;
      const declaration = `\n\n{#snippet ${name}(${parameters})}${body}{/snippet}`;
      markup += declaration;
      holes &&= holes + declaration;
    }
    imported = importBlock();
  }
  const warnings = [
    imported.unresolved.map((name) => `Import not resolved: \`${name}\`.`).join(' '),
    imported.unresolvedIdentifiers
      ?.map((name) => `Identifier not resolved: \`${name}\`.`)
      .join(' '),
    unresolvedWarning(resolved.unresolved.filter((name) => !imported.declared.includes(name))),
    renders ? RENDER_WARNING : undefined,
  ].filter(Boolean);
  const withImports = (code: string) => (imported.block ? `${imported.block}\n\n${code}` : code);
  return {
    snippet: withImports(markup),
    ...(warnings.length ? { warning: warnings.join(' ') } : {}),
    ...(holes === undefined
      ? {}
      : { template: withImports(holes), argCode: argCode(resolved.args) }),
  };
}

/**
 * The code a story writes each arg with, which the preview fills a template with while the arg
 * keeps that value: every arg but a string, `true`, `false`, `null`, `undefined` or a number written
 * as the preview prints it, which print as their value.
 */
export function argCode(args: Record<string, Node>): Record<string, string> {
  const code: Record<string, string> = {};
  for (const [name, value] of Object.entries(args)) {
    const node = unwrapExpression(value);
    if (literalOf(node) === undefined) {
      code[name] = textOf(node);
    }
  }
  return code;
}

/** The value of an arg written as a literal the preview prints as written, as `{ value }`. */
export function literalOf(node: Node): { value: unknown } | undefined {
  if (node.type === 'Identifier' && node.name === 'undefined') return { value: undefined };
  if (node.type === 'Literal') {
    const { value } = node;
    if (typeof value === 'string' || typeof value === 'boolean' || value === null) {
      return { value };
    }
    return typeof value === 'number' && textOf(node) === String(value) ? { value } : undefined;
  }
  if (
    node.type === 'UnaryExpression' &&
    node.operator === '-' &&
    node.argument.type === 'Literal' &&
    typeof node.argument.value === 'number' &&
    textOf(node) === String(-node.argument.value)
  ) {
    return { value: -node.argument.value };
  }
  return undefined;
}

// Print an arg that holds a snippet as a `{#snippet}` child: a snippet the story file declares,
// or a `createRawSnippet` call that renders static markup.
function snippetArg(
  key: string,
  value: Node,
  file: StoryFile,
  bindings: Map<string, ImportBinding>
): string | undefined {
  const node = unwrapExpression(value);
  if (node.type === 'Identifier' && file.snippets.has(node.name)) {
    const { parameters, body } = file.snippets.get(node.name)!;
    return `{#snippet ${key}(${parameters})}${body}{/snippet}`;
  }
  if (
    node.type !== 'CallExpression' ||
    node.callee.type !== 'Identifier' ||
    bindings.get(node.callee.name)?.importId !== 'svelte' ||
    bindings.get(node.callee.name)?.importName !== 'createRawSnippet'
  ) {
    return undefined;
  }
  const factory = node.arguments[0] && unwrapExpression(node.arguments[0]);
  const result =
    factory && (factory.type === 'ArrowFunctionExpression' || factory.type === 'FunctionExpression')
      ? returnedExpression(factory)
      : undefined;
  if (result?.type !== 'ObjectExpression') return undefined;
  for (const property of result.properties) {
    if (property.type !== 'Property' || staticKey(property) !== 'render') continue;
    const render = unwrapExpression(property.value);
    const body =
      render.type === 'ArrowFunctionExpression' || render.type === 'FunctionExpression'
        ? returnedExpression(render)
        : undefined;
    const html =
      body?.type === 'Literal' && typeof body.value === 'string'
        ? body.value
        : body?.type === 'TemplateLiteral' && body.expressions.length === 0
          ? body.quasis.map((part) => part.value.cooked ?? part.value.raw).join('')
          : undefined;
    // Raw HTML has no expressions, so its braces are text.
    if (html !== undefined) {
      return `{#snippet ${key}()}${html.replaceAll('{', '&#123;').replaceAll('}', '&#125;')}{/snippet}`;
    }
  }
  return undefined;
}

// The args a story is written with, as the preview has them before a control changes one: each
// with `argCode` as that code, any other as its value.
function ownArgs(args: Record<string, Node>): Args {
  const code = argCode(args);
  return Object.fromEntries(
    Object.entries(args).map(([name, node]) => [
      name,
      Object.hasOwn(code, name)
        ? writtenArg(code[name]!)
        : literalOf(unwrapExpression(node))!.value,
    ])
  );
}
