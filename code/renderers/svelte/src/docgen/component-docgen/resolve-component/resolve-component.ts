import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  type ExportReader,
  createComponentNodeResolver,
  createModuleResolver,
  defaultResolveConditionNames,
  extractDeclaredSubcomponents,
  extractSubcomponents,
  getStoryImportPathFromEntry,
  jsTsSourceExtensions,
  typescriptExtensionAlias,
} from 'storybook/internal/common';
import {
  type CsfFile,
  type ESTree as E,
  type ESTreeNode,
  SourceEditor,
  loadCsf,
  parseExpression,
  propertyValue,
  type ReferenceModule,
} from 'storybook/internal/csf-tools';
import type { IndexEntry } from 'storybook/internal/types';

import { parseSvelteSource } from '../../../svelte-csf/indexer/parser.ts';
import { getDefineMetaFirstArgumentObjectExpression } from '../../../svelte-csf/parser/extract/svelte/define-meta.ts';
import { extractSvelteASTNodes } from '../../../svelte-csf/parser/extract/svelte/nodes.ts';

export interface ResolvedSvelteComponent {
  componentPath: string;
  exportName: string;
  name: string;
}

const moduleResolver = createModuleResolver({
  extensions: ['.svelte', ...jsTsSourceExtensions],
  // TypeScript projects import `./index.ts` as `./index.js`, as SvelteKit's packaging requires.
  extensionAlias: typescriptExtensionAlias,
  mainFields: ['svelte', 'module', 'main'],
  // Core's conditions plus `svelte`, so a `storybook` entry resolves as it does in the preview.
  conditionNames: ['svelte', ...defaultResolveConditionNames],
  tsconfig: 'auto',
});

// The editor of the JS a module exposes: a `.svelte` file's module script, or the file itself.
// `undefined` when it cannot be read or parsed.
function moduleEditor(filePath: string) {
  try {
    const file = readFileSync(filePath, 'utf8');
    if (!filePath.endsWith('.svelte')) return new SourceEditor(file, filePath);
    const { source, ast } = parseSvelteSource(file);
    const module = ast.module?.content as { start: number; end: number } | undefined;
    return module && new SourceEditor(source.slice(module.start, module.end), `${filePath}.ts`);
  } catch {
    return undefined;
  }
}

function readModule(filePath: string): ReferenceModule | undefined {
  const editor = moduleEditor(filePath);
  return editor && { editor, filePath };
}

// A component is the default export of a `.svelte` file; its module script exports the rest.
const isComponent = (filePath: string, exportName: string) =>
  filePath.endsWith('.svelte') && exportName === 'default';

const exportReader: ExportReader = {
  resolver: moduleResolver,
  readModule,
  ownsExport: isComponent,
};

// Core reads every module in the chain with this reader, so a `.svelte` file in it exposes its
// module script, and the declaration core follows an import to is a `.svelte` file's default.
const resolveComponentExpression = createComponentNodeResolver({ reader: exportReader });

const unresolved = (specifier: string, exportName: string) =>
  new Error(`Could not resolve \`${specifier}\` export \`${exportName}\``);

// A story file read for the components it names: a CSF file, or a Svelte CSF file's `defineMeta`
// object and module script.
type StoryFile = { storyPath: string } & (
  | { csf: CsfFile }
  | { meta: E.ObjectExpression | undefined; module: ReferenceModule }
);

async function readStoryFile(entry: IndexEntry): Promise<StoryFile | undefined> {
  const importPath = getStoryImportPathFromEntry(entry);
  if (!importPath) return undefined;
  const storyPath = resolve(importPath);
  const file = await readFile(storyPath, 'utf8');
  return storyPath.endsWith('.svelte')
    ? { storyPath, ...(await readSvelteMeta(file, storyPath)) }
    : { storyPath, csf: loadCsf(file, { makeTitle: () => entry.title }).parse() };
}

// The component a node in the meta names: `meta.component` when `node` is left out, else one entry
// of `meta.subcomponents`. Throws when the node names an import that does not lead to a component.
function resolveComponentNode(
  story: StoryFile,
  node?: ESTreeNode
): ResolvedSvelteComponent | undefined {
  const { module, meta } =
    'csf' in story
      ? {
          module: { editor: story.csf.editor, filePath: story.storyPath },
          meta: story.csf._metaAnnotations.component,
        }
      : { module: story.module, meta: propertyValue(story.meta, 'component') };
  const expression = node ?? meta;
  if (!expression) return undefined;

  const resolved = resolveComponentExpression(module, expression);
  if ('reason' in resolved) {
    switch (resolved.reason) {
      case 'unreadable-component-expression':
        throw new Error(`Cannot resolve the component \`${resolved.expression}\``);
      case 'missing-export':
        throw unresolved(resolved.importId, resolved.exportName);
      case 'no-meta-component':
      case 'no-component-import':
        return undefined;
      default: {
        const unhandled: never = resolved;
        throw new Error(`Unhandled resolution ${JSON.stringify(unhandled)}`);
      }
    }
  }
  const { importId, path, exportName, localName } = resolved.component;
  if (!importId) return undefined;
  if (!path || !isComponent(path, exportName)) throw unresolved(importId, exportName);
  return { componentPath: path, exportName, name: localName };
}

export async function resolveStoryComponent(
  entry: IndexEntry
): Promise<ResolvedSvelteComponent | undefined> {
  const story = await readStoryFile(entry);
  return story && resolveComponentNode(story);
}

// The meta component of a story file the caller has already parsed as CSF, as
// `resolveStoryComponent` resolves it.
export function resolveCsfComponent(
  storyPath: string,
  csf: CsfFile
): ResolvedSvelteComponent | undefined {
  return resolveComponentNode({ storyPath, csf });
}

// The components a meta lists in `subcomponents`, by the name it lists them under. They resolve
// like the meta's own component. One that does not resolve is left out, so it does not cost the
// main component its docs.
export async function resolveStorySubcomponents(
  entry: IndexEntry
): Promise<Record<string, ResolvedSvelteComponent>> {
  const story = await readStoryFile(entry);
  if (!story) return {};
  const declared =
    'csf' in story
      ? extractDeclaredSubcomponents(story.csf)
      : extractSubcomponents(
          propertyValue(story.meta, 'subcomponents'),
          story.module.editor.program
        );
  const resolved: Record<string, ResolvedSvelteComponent> = {};
  for (const { name, node } of declared) {
    try {
      const component = resolveComponentNode(story, node);
      if (component) resolved[name] = { ...component, name };
    } catch {
      continue;
    }
  }
  return resolved;
}

async function readSvelteMeta(file: string, storyPath: string) {
  const { source, ast } = parseSvelteSource(file);
  const nodes = await extractSvelteASTNodes({ ast, filename: storyPath });
  const { start, end } = getDefineMetaFirstArgumentObjectExpression({
    nodes,
    filename: storyPath,
  }) as unknown as { start: number; end: number };
  const script = ast.module!.content as unknown as { start: number; end: number };
  const meta = parseExpression(source.slice(start, end));
  return {
    meta: meta.type === 'ObjectExpression' ? meta : undefined,
    module: {
      editor: new SourceEditor(source.slice(script.start, script.end), `${storyPath}.ts`),
      filePath: storyPath,
    },
  };
}
