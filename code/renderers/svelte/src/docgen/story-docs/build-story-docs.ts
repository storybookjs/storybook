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
import type { StoryDoc, StoryDocsPayload, StoryDocsProviderInput } from 'storybook/internal/types';

import { printTemplate } from './print-template.ts';
import { buildSnippetImportBlock } from './snippet-imports.ts';
import { type StoryFile, readSvelteCsfFile } from './svelte-csf-file.ts';

const openStoryReferences = createStoryReferenceResolver({ extensions: ['.svelte'] });

const RENDER_WARNING = 'The render function is not reflected in this snippet.';

export async function buildStoryDocsPayload(
  input: StoryDocsProviderInput
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
      stories[id] = { ...doc, ...storySnippet(exportName, resolver.resolve(exportName), context) };
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
): Pick<StoryDoc, 'snippet' | 'warning'> {
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

  let markup = printTemplate({
    code: template,
    args: resolved.args,
    typescript: file.typescript,
    parameter: story?.parameter,
    snippets,
    argsComplete: resolved.unresolved.length === 0,
  });
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
      markup += `\n\n{#snippet ${name}(${parameters})}${body}{/snippet}`;
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
  return {
    snippet: imported.block ? `${imported.block}\n\n${markup}` : markup,
    ...(warnings.length ? { warning: warnings.join(' ') } : {}),
  };
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
