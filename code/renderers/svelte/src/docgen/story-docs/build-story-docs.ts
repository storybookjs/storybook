import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { types as t } from 'storybook/internal/babel';
import { getComponentIdFromEntry, getStoryImportPathFromEntry } from 'storybook/internal/common';
import { getService } from 'storybook/internal/core-server';
import { storyNameFromExport, toId } from 'storybook/internal/csf';
import {
  collectImportBindings,
  createStoryArgsResolver,
  extractStoryJSDocInfo,
  jsDocTagsForPath,
  loadCsf,
  metaObjectPath,
  unresolvedWarning,
} from 'storybook/internal/csf-tools';
import type {
  DocgenPayload,
  StoryDoc,
  StoryDocsPayload,
  StoryDocsProviderInput,
} from 'storybook/internal/types';
import type { DocgenService } from 'storybook/open-service';

import { getSvelteAST } from '../../svelte-csf/parser/ast.ts';
import { getDefineMetaFirstArgumentObjectExpression } from '../../svelte-csf/parser/extract/svelte/define-meta.ts';
import { getStoriesIdentifiers } from '../../svelte-csf/parser/analyse/story/attributes/identifiers.ts';
import { getStoryContentRawCode } from '../../svelte-csf/parser/analyse/story/content.ts';
import { extractSvelteASTNodes } from '../../svelte-csf/parser/extract/svelte/nodes.ts';
import { extractStoryAttributesNodes } from '../../svelte-csf/parser/extract/svelte/story/attributes.ts';
import { printPlainCsfSnippet } from './plain-csf-snippets.ts';
import { buildSnippetImportBlock } from './snippet-imports.ts';
import { readStaticArgs } from './static-args.ts';
import { printSvelteCsfSnippet } from './svelte-csf-snippets.ts';

export interface BuildStoryDocsContext {
  readDocgen?: (id: string) => Promise<DocgenPayload | undefined>;
}

async function readDocgen(id: string) {
  const service = getService<DocgenService>('core/docgen', { internal: true });
  return service.queries.docgen.get({ id }) ?? service.queries.docgen.loaded({ id });
}

export async function buildStoryDocsPayload(
  input: StoryDocsProviderInput,
  context: BuildStoryDocsContext = {}
): Promise<StoryDocsPayload | undefined> {
  const path = getStoryImportPathFromEntry(input.entry);
  if (!path) return undefined;
  const filename = resolve(path);
  const source = await readFile(filename, 'utf8');
  const templates = new Map<string, { code: string; description?: string }>();
  const snippets = new Map<string, string>();
  let csfSource = source;
  let instanceScript: { code: string; typescript: boolean } | undefined;
  if (filename.endsWith('.svelte')) {
    const ast = getSvelteAST({ code: source, filename });
    if (ast.instance) {
      instanceScript = {
        code: source.slice(
          position(ast.instance.content).start,
          position(ast.instance.content).end
        ),
        typescript: ast.instance.attributes.some(
          (attribute) =>
            attribute.name === 'lang' &&
            Array.isArray(attribute.value) &&
            attribute.value.some((value) => value.type === 'Text' && value.data === 'ts')
        ),
      };
    }
    const nodes = await extractSvelteASTNodes({ ast, filename });
    const meta = getDefineMetaFirstArgumentObjectExpression({ nodes, filename });
    const declaration = nodes.defineMetaVariableDeclaration;
    if (!ast.module) return undefined;
    const moduleStart = position(ast.module.content).start;
    csfSource =
      source.slice(moduleStart, position(declaration).start) +
      `export default ${source.slice(position(meta).start, position(meta).end)};` +
      source.slice(position(declaration).end, position(ast.module.content).end);
    const identifiers = getStoriesIdentifiers({ nodes, filename });
    for (const [index, story] of nodes.storyComponents.entries()) {
      const identifier = identifiers[index];
      const attributes = extractStoryAttributesNodes({
        component: story.component,
        attributes: ['args'],
      });
      const value = attributes.args?.value;
      const chunk = Array.isArray(value) ? value[0] : value;
      const expression =
        chunk && chunk !== true && chunk.type === 'ExpressionTag' ? chunk.expression : undefined;
      csfSource += `\nexport const ${identifier.exportName} = { name: ${JSON.stringify(identifier.name)}, args: ${expression ? source.slice(position(expression).start, position(expression).end) : '{}'} };`;
      const code = getStoryContentRawCode({
        nodes: { component: story.component, svelte: nodes },
        originalCode: source,
        filename,
      });
      if (!code.startsWith('<undefined ')) {
        templates.set(identifier.exportName, { code, description: story.comment?.data.trim() });
      }
    }
    for (const snippet of nodes.snippetBlocks) {
      const first = snippet.body.nodes[0];
      const last = snippet.body.nodes.at(-1);
      snippets.set(
        snippet.expression.name,
        first && last ? source.slice(first.start, last.end).trim() : ''
      );
    }
  }
  const csf = loadCsf(csfSource, { makeTitle: () => input.entry.title }).parse();
  const id = getComponentIdFromEntry(input.entry);
  const docgen = await (context.readDocgen ?? readDocgen)(id);
  const argTypes = docgen?.argTypes ?? {};
  const bindings = collectImportBindings(csf._file.path);
  const snippetFactories = new Set(
    [...bindings]
      .filter(
        ([, binding]) => binding.importId === 'svelte' && binding.importName === 'createRawSnippet'
      )
      .map(([name]) => name)
  );
  const mockFactories = new Set(
    [...bindings]
      .filter(([, binding]) => binding.importId === 'storybook/test' && binding.importName === 'fn')
      .map(([name]) => name)
  );
  const importOverride = jsDocTagsForPath(metaObjectPath(csf)).import?.[0];
  const resolver = createStoryArgsResolver(csf);
  const stories: Record<string, StoryDoc> = {};
  for (const [exportName, story] of Object.entries(csf._stories)) {
    const template = templates.get(exportName);
    const resolved = resolver.resolve(exportName);
    const snippetArgs: string[] = [];
    const argNodes = { ...resolved.args };
    for (const [key, node] of Object.entries(argNodes)) {
      if (t.isIdentifier(node) && snippets.has(node.name)) {
        snippetArgs.push(`{#snippet ${key}()}${snippets.get(node.name)}{/snippet}`);
        delete argNodes[key];
      }
    }
    const staticArgs = readStaticArgs(argNodes, { snippetFactories, mockFactories });
    for (const [name, body] of Object.entries(staticArgs.snippets))
      snippetArgs.push(`{#snippet ${name}()}${body}{/snippet}`);
    const componentName =
      csf.meta.component && /^[A-Z][\w$]*(?:\.[\w$]+)*$/.test(csf.meta.component)
        ? csf.meta.component
        : undefined;
    let markup = template
      ? printSvelteCsfSnippet({ code: template.code, args: staticArgs.args, argTypes })
      : componentName && !filename.endsWith('.svelte')
        ? printPlainCsfSnippet({ componentName, args: staticArgs.args, argTypes })
        : undefined;
    if (markup && snippetArgs.length > 0) {
      const root = /^\s*<([A-Z][\w$.]*)\b/.exec(markup);
      if (root) {
        markup = markup.endsWith('/>')
          ? `${markup.slice(0, -2)}>\n${snippetArgs.join('\n')}\n</${root[1]}>`
          : markup.replace(
              new RegExp(`</${root[1].replaceAll('.', '\\.')}>\\s*$`),
              `${snippetArgs.join('\n')}\n</${root[1]}>`
            );
      }
    }
    if (markup) {
      for (const [name, body] of snippets) {
        if (new RegExp(`\\{\\s*${name}\\s*\\}`).test(markup)) {
          markup += `\n\n{#snippet ${name}()}${body}{/snippet}`;
        }
      }
    }
    const imported = markup
      ? buildSnippetImportBlock(markup, { bindings, importOverride, instanceScript })
      : undefined;
    const warnings = [
      imported?.unresolved.map((name) => `Import not resolved: \`${name}\`.`).join(' '),
      imported?.unresolvedIdentifiers
        ?.map((name) => `Identifier not resolved: \`${name}\`.`)
        .join(' '),
      unresolvedWarning([...resolved.unresolved, ...staticArgs.unresolved]),
      !template &&
      (resolved.storyMembers.properties.render || resolved.metaMembers.properties.render)
        ? 'The render function is not reflected in this snippet.'
        : undefined,
    ].filter(Boolean);
    const storyId = filename.endsWith('.svelte')
      ? toId(csf.meta.id ?? csf.meta.title ?? input.entry.title, storyNameFromExport(exportName))
      : story.id;
    stories[storyId] = {
      id: storyId,
      name: story.name ?? exportName,
      ...extractStoryJSDocInfo(csf._storyStatements[exportName]),
      ...(template?.description ? { description: template.description } : {}),
      ...(markup ? { snippet: imported?.block ? `${imported.block}\n\n${markup}` : markup } : {}),
      ...(warnings.length > 0 ? { warning: warnings.join(' ') } : {}),
    };
  }
  return { id, name: csf.meta.component ?? docgen?.name ?? input.entry.title, path, stories };
}

function position(node: object): { start: number; end: number } {
  if (
    'start' in node &&
    typeof node.start === 'number' &&
    'end' in node &&
    typeof node.end === 'number'
  ) {
    return { start: node.start, end: node.end };
  }
  throw new TypeError('Svelte AST node has no source positions');
}
