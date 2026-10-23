import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  canonicalizeTurbosnapHtml,
  resolveTurbosnapOutputReference,
  versions,
} from 'storybook/internal/common';
import { type ESTree, parseModule, walk } from 'storybook/internal/csf-tools';
import type { TurbosnapOutputDraft } from 'storybook/internal/types';

import { isAbsolute, relative } from 'pathe';
import type { ModuleInfo, OutputBundle, OutputChunk } from 'rollup';
import type { ResolvedConfig } from 'vite';

import { SB_VIRTUAL_FILES } from './virtual-file-names.ts';

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const storyLoader = `\0${SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE}`;
type Node = Parameters<typeof walk>[0];
type Span = { start: number; end: number; value: string };
type Edge = { file: string; story?: string };

export function isGeneratedViteStoryLoader(
  code: string,
  stories: ReadonlyMap<string, string>
): boolean {
  const script = (preload: boolean) =>
    `${preload ? 'import { __vitePreload } from "\\u0000vite/preload-helper.js";' : ''}const importers = {${[...stories].map(([name, id]) => `${JSON.stringify(name)}: () => ${preload ? '__vitePreload(() => ' : ''}import(${JSON.stringify(id)})${preload ? ',__VITE_IS_MODERN__?__VITE_PRELOAD__:void 0,import.meta.url)' : ''}`).join(',')}}; export async function importFn(path) { return await importers[path](); }`;
  const normalized = (source: string) =>
    JSON.stringify(parseModule(source, 'story-loader.js').program, (key, value) =>
      ['start', 'end', 'loc', 'raw'].includes(key) ? undefined : value
    );
  const actual = normalized(code);
  return actual === normalized(script(false)) || actual === normalized(script(true));
}

function hasGeneratedLoaderUsage(program: Node, object: ESTree.ObjectExpression): boolean {
  const parents = new Map<Node, Node | null>();
  const names = new Map<string, Node[]>();
  walk(program, (node, parent) => {
    parents.set(node, parent);
    if (node.type === 'Identifier') {
      const uses = names.get(node.name);
      if (uses) uses.push(node);
      else names.set(node.name, [node]);
    }
  });
  const declaration = parents.get(object);
  if (declaration?.type !== 'VariableDeclarator' || declaration.id.type !== 'Identifier')
    return false;
  const variable = parents.get(declaration);
  if (variable?.type !== 'VariableDeclaration' || parents.get(variable) !== program) return false;
  const references = names.get(declaration.id.name) ?? [];
  if (references.length !== 2) return false;
  const reference = references.find((node) => node !== declaration.id);
  if (!reference) return false;
  const member = parents.get(reference);
  if (
    member?.type !== 'MemberExpression' ||
    member.object !== reference ||
    !member.computed ||
    member.property.type !== 'Identifier'
  )
    return false;
  const call = parents.get(member);
  if (call?.type !== 'CallExpression' || call.callee !== member || call.arguments.length)
    return false;
  const awaited = parents.get(call);
  if (awaited?.type !== 'AwaitExpression') return false;
  const returned = parents.get(awaited);
  if (returned?.type !== 'ReturnStatement') return false;
  const body = parents.get(returned);
  if (body?.type !== 'BlockStatement' || body.body.length !== 1) return false;
  const fn = parents.get(body);
  if (
    fn?.type !== 'FunctionDeclaration' ||
    !fn.async ||
    !fn.id ||
    fn.params.length !== 1 ||
    fn.params[0].type !== 'Identifier' ||
    fn.params[0].name !== member.property.name ||
    parents.get(fn) !== program
  )
    return false;
  const uses = names.get(fn.id.name) ?? [];
  if (uses.length !== 2) return false;
  const use = uses.find((node) => node !== fn.id);
  if (!use) return false;
  const constructor = parents.get(use);
  if (
    constructor?.type !== 'NewExpression' ||
    constructor.arguments[0] !== use ||
    constructor.callee.type !== 'Identifier'
  )
    return false;
  const constructorReferences = names.get(constructor.callee.name) ?? [];
  if (constructorReferences.length !== 2) return false;
  const binding = constructorReferences.find((node) => node !== constructor.callee);
  if (!binding) return false;
  const property = parents.get(binding);
  if (
    property?.type !== 'Property' ||
    property.value !== binding ||
    property.computed ||
    property.key.type !== 'Identifier' ||
    property.key.name !== 'PreviewWeb'
  )
    return false;
  const pattern = parents.get(property);
  const initialized = pattern && parents.get(pattern);
  if (
    pattern?.type !== 'ObjectPattern' ||
    initialized?.type !== 'VariableDeclarator' ||
    initialized.init?.type !== 'Identifier' ||
    initialized.init.name !== '__STORYBOOK_MODULE_PREVIEW_API__'
  )
    return false;
  const fallback = parents.get(constructor);
  if (
    fallback?.type !== 'LogicalExpression' ||
    fallback.operator !== '||' ||
    fallback.right !== constructor
  )
    return false;
  const assignment = parents.get(fallback);
  if (assignment?.type !== 'AssignmentExpression' || assignment.right !== fallback) return false;
  const preview = (node: Node) =>
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'window' &&
    node.property.type === 'Identifier' &&
    node.property.name === '__STORYBOOK_PREVIEW__';
  return preview(assignment.left) && preview(fallback.left);
}

function rewrite(source: string, spans: Span[]) {
  return spans
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, { start, end, value }) => result.slice(0, start) + value + result.slice(end),
      source
    );
}

export function canonicalizeViteChunk(
  chunk: Pick<OutputChunk, 'fileName' | 'code'>,
  identities: ReadonlyMap<string, string>,
  stories: ReadonlyMap<string, string>,
  trustedDynamicImports = false,
  preloadFiles: ReadonlySet<string> = new Set()
): {
  code: string;
  edges: Edge[];
  storyFiles: Map<string, string>;
  filenameSensitive: boolean;
  preloads: Set<string>;
} {
  const { code: parsedCode, program, comments } = parseModule(chunk.code, chunk.fileName);
  if (parsedCode !== chunk.code) throw new Error('normalized-output-source');
  const spans: Span[] = [];
  const storyImports = new Map<number, string>();
  const storyFiles = new Map<string, string>();
  const edges: Edge[] = [];
  let loaders = 0;
  let filenameSensitive = false;
  const preloads = new Set<string>();
  const aliases = new Map<string, string>();
  const parents = new Map<Node, Node | null>();
  walk(program, (node, parent) => {
    parents.set(node, parent);
    if (node.type === 'ImportDeclaration') {
      const target = resolveTurbosnapOutputReference(
        String(node.source.value),
        chunk.fileName,
        identities
      );
      if (target && preloadFiles.has(target.file))
        for (const specifier of node.specifiers)
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === '_'
          )
            aliases.set(specifier.local.name, target.file);
    }
  });
  walk(program, (node, parent) => {
    if (
      node.type === 'Identifier' &&
      aliases.has(node.name) &&
      !(
        (parent?.type === 'ImportSpecifier' && parent.local === node) ||
        (parent?.type === 'CallExpression' && parent.callee === node)
      )
    )
      aliases.delete(node.name);
  });

  walk(program, (node) => {
    if (
      node.type !== 'ObjectExpression' ||
      node.properties.length !== stories.size ||
      !stories.size
    )
      return;
    const found = new Map<number, { story: string; file: string }>();
    for (const property of node.properties) {
      if (
        property.type !== 'Property' ||
        property.computed ||
        property.key.type !== 'Literal' ||
        typeof property.key.value !== 'string'
      )
        return;
      const expected = stories.get(property.key.value);
      if (
        !expected ||
        property.value.type !== 'ArrowFunctionExpression' ||
        property.value.params.length ||
        property.value.body.type === 'BlockStatement'
      )
        return;
      const imports: ESTree.ImportExpression[] = [];
      walk(property.value, (child) => {
        if (child.type === 'ImportExpression') imports.push(child);
      });
      if (imports.length !== 1) return;
      const source = imports[0].source;
      if (source.type !== 'Literal' || typeof source.value !== 'string') return;
      const file = resolveTurbosnapOutputReference(source.value, chunk.fileName, identities)?.file;
      if (file !== expected) return;
      found.set(imports[0].start, { story: property.key.value, file });
    }
    if (!hasGeneratedLoaderUsage(program, node)) throw new Error('unrecognized-story-loader-usage');
    loaders += 1;
    for (const [position, { story, file }] of found) {
      storyImports.set(position, story);
      storyFiles.set(story, file);
    }
  });
  if (loaders > 1) throw new Error('ambiguous-story-loader');

  walk(program, (node) => {
    let source: ESTree.Expression | undefined;
    if (node.type === 'ImportExpression') source = node.source;
    else if (
      node.type === 'ImportDeclaration' ||
      node.type === 'ExportAllDeclaration' ||
      node.type === 'ExportNamedDeclaration'
    )
      source = node.source ?? undefined;
    if (source) {
      if (source.type !== 'Literal' || typeof source.value !== 'string') {
        if (trustedDynamicImports && node.type === 'ImportExpression') return;
        throw new Error('dynamic-output-reference');
      }
      if (!/^(?:\.{1,2}\/|\/)/.test(source.value)) throw new Error('unresolved-output-reference');
      const target = resolveTurbosnapOutputReference(source.value, chunk.fileName, identities);
      if (!target) throw new Error('unresolved-output-reference');
      if (target) {
        const file = target.file;
        spans.push({
          start: source.start,
          end: source.end,
          value: JSON.stringify(target.value),
        });
        edges.push({ file, story: storyImports.get(node.start) });
      }
    }
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      node.id.name === '__vite__mapDeps'
    ) {
      const arrays: ESTree.ArrayExpression[] = [];
      walk(node, (child) => {
        if (child.type === 'ArrayExpression') arrays.push(child);
      });
      if (arrays.length !== 1) throw new Error('unknown-preload-map');
      const array = arrays[0];
      const shape =
        chunk.code.slice(node.start, array.start) + '[]' + chunk.code.slice(array.end, node.end);
      if (shape !== '__vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=[])))=>i.map(i=>d[i])')
        throw new Error('unknown-preload-map');
      for (const element of array.elements) {
        if (element?.type !== 'Literal' || typeof element.value !== 'string')
          throw new Error('dynamic-preload-reference');
        const target = resolveTurbosnapOutputReference(element.value, chunk.fileName, identities);
        if (target)
          spans.push({
            start: element.start,
            end: element.end,
            value: JSON.stringify(target.value),
          });
      }
    }
  });
  walk(program, (node, parent) => {
    if (node.type !== 'MetaProperty' || node.meta.name !== 'import') return;
    const call = parent && parents.get(parent);
    if (
      parent?.type === 'MemberExpression' &&
      !parent.computed &&
      parent.property.type === 'Identifier' &&
      parent.property.name === 'url' &&
      call?.type === 'CallExpression' &&
      call.arguments[2] === parent &&
      call.callee.type === 'Identifier' &&
      aliases.has(call.callee.name)
    )
      preloads.add(aliases.get(call.callee.name)!);
    else filenameSensitive = true;
  });
  for (const comment of comments) {
    const match = /^# sourceMappingURL=(\S+)$/.exec(comment.value.trim());
    if (!match) continue;
    const target = resolveTurbosnapOutputReference(match[1], chunk.fileName, identities);
    if (target)
      spans.push({
        start: comment.start,
        end: comment.end,
        value: `//# sourceMappingURL=${target.value}`,
      });
  }
  return { code: rewrite(chunk.code, spans), edges, storyFiles, filenameSensitive, preloads };
}

export class ViteOutputEvidence {
  private readonly modules = new Map<
    string,
    Pick<ModuleInfo, 'code' | 'importedIds' | 'dynamicallyImportedIds'>
  >();
  private config: ResolvedConfig | undefined;
  private draft: TurbosnapOutputDraft = {
    status: 'incomplete',
    reason: 'missing-output',
    builder: { name: '@storybook/builder-vite', version: versions['@storybook/builder-vite'] },
    outputFiles: {},
    globalOutputHash: '',
    storyOutputHashes: {},
  };

  constructor(private readonly workingDir: string) {}

  resolved(config: ResolvedConfig) {
    this.config = config;
  }

  module(info: Pick<ModuleInfo, 'id' | 'code' | 'importedIds' | 'dynamicallyImportedIds'>) {
    this.modules.set(info.id, info);
  }

  async bundle(bundle: OutputBundle) {
    try {
      const normalized = (id: string) =>
        isAbsolute(id) ? `./${relative(this.workingDir, id)}` : id;
      const chunks = Object.values(bundle).filter(
        (item): item is OutputChunk => item.type === 'chunk'
      );
      const identities = new Map<string, string>();
      const hashes = new Map<string, string>();
      for (const chunk of chunks) {
        const identity = digest(
          JSON.stringify([
            normalized(chunk.facadeModuleId ?? ''),
            Object.keys(chunk.modules).map(normalized).sort(),
          ])
        );
        if ([...identities.values()].includes(identity))
          throw new Error('ambiguous-chunk-identity');
        identities.set(chunk.fileName, identity);
        if (bundle[`${chunk.fileName}.map`])
          identities.set(`${chunk.fileName}.map`, `${identity}:map`);
      }
      const loader = this.modules.get(storyLoader);
      if (!loader) throw new Error('missing-story-loader');
      const stories = new Map<string, string>();
      for (const id of loader.dynamicallyImportedIds) {
        const chunk = chunks.find((candidate) => candidate.facadeModuleId === id);
        if (!chunk || !isAbsolute(id)) throw new Error('unmapped-story-output');
        stories.set(normalized(id), chunk.fileName);
      }
      if (!stories.size) throw new Error('missing-story-output');
      if (
        !loader.code ||
        !isGeneratedViteStoryLoader(
          loader.code,
          new Map(loader.dynamicallyImportedIds.map((id) => [normalized(id), id]))
        )
      )
        throw new Error('transformed-story-loader');
      const graph = new Map<string, Edge[]>();
      const storyFiles = new Map<string, string>();
      const raw: Record<string, string> = {};
      const mockerRuntime = fileURLToPath(
        import.meta.resolve('storybook/internal/mocking-utils/mocker-runtime')
      );
      const preloadFiles = new Set(
        chunks
          .filter(
            (chunk) =>
              Object.keys(chunk.modules).length === 1 && '\0vite/preload-helper.js' in chunk.modules
          )
          .map((chunk) => chunk.fileName)
      );
      const verifiedPreloads = new Set<string>();
      const filenameUses = new Map<string, { filenameSensitive: boolean; preloads: Set<string> }>();
      for (const chunk of chunks) {
        const isMocker =
          chunk.facadeModuleId === mockerRuntime &&
          Object.keys(chunk.modules).length === 1 &&
          mockerRuntime in chunk.modules;
        const canonical = canonicalizeViteChunk(
          chunk,
          identities,
          storyLoader in chunk.modules ? stories : new Map(),
          isMocker,
          preloadFiles
        );
        if (isMocker) {
          if (!this.config) throw new Error('missing-resolved-config');
          const { build } = await import('vite');
          const reference = await build({
            root: this.config.root,
            configFile: false,
            publicDir: false,
            base: this.config.base,
            logLevel: 'silent',
            build: {
              write: false,
              target: this.config.build.target,
              minify: this.config.build.minify,
              sourcemap: this.config.build.sourcemap,
              rollupOptions: {
                input: mockerRuntime,
                preserveEntrySignatures: false,
                output: {
                  entryFileNames: chunk.fileName,
                  manualChunks: (id) =>
                    id.includes('preload-helper') ? 'preload-helper' : undefined,
                },
              },
            },
          });
          if (Array.isArray(reference) || !('output' in reference))
            throw new Error('unsupported-mocker-reference');
          const referenceChunk = reference.output.find(
            (file): file is OutputChunk =>
              file.type === 'chunk' && file.facadeModuleId === mockerRuntime
          );
          if (!referenceChunk) throw new Error('missing-mocker-reference');
          const referenceIds = new Map(identities);
          for (const file of reference.output) {
            if (file.type !== 'chunk') continue;
            const identity = digest(
              JSON.stringify([
                normalized(file.facadeModuleId ?? ''),
                Object.keys(file.modules).map(normalized).sort(),
              ])
            );
            referenceIds.set(file.fileName, identity);
            if (reference.output.some((asset) => asset.fileName === `${file.fileName}.map`))
              referenceIds.set(`${file.fileName}.map`, `${identity}:map`);
          }
          const expected = canonicalizeViteChunk(
            referenceChunk,
            referenceIds,
            new Map(),
            true
          ).code;
          if (canonical.code !== expected) throw new Error('modified-mocker-runtime');
          for (const file of reference.output) {
            if (
              file.type !== 'chunk' ||
              Object.keys(file.modules).length !== 1 ||
              !('\0vite/preload-helper.js' in file.modules)
            )
              continue;
            const actual = chunks.find((chunk) => preloadFiles.has(chunk.fileName));
            if (
              actual &&
              canonicalizeViteChunk(actual, identities, new Map()).code ===
                canonicalizeViteChunk(file, referenceIds, new Map()).code
            )
              verifiedPreloads.add(actual.fileName);
          }
        }
        hashes.set(chunk.fileName, digest(canonical.code));
        filenameUses.set(chunk.fileName, canonical);
        graph.set(chunk.fileName, canonical.edges);
        for (const [story, file] of canonical.storyFiles) {
          if (storyFiles.has(story)) throw new Error('ambiguous-story-loader');
          storyFiles.set(story, file);
        }
        raw[chunk.fileName] = digest(chunk.code);
        const map = bundle[`${chunk.fileName}.map`];
        if (map?.type === 'asset') {
          const source = JSON.parse(String(map.source));
          if (source.file !== chunk.fileName.split('/').at(-1) && source.file !== chunk.fileName)
            throw new Error('unknown-source-map-owner');
          source.file = identities.get(chunk.fileName);
          hashes.set(map.fileName, digest(JSON.stringify(source)));
          raw[map.fileName] = digest(map.source);
        }
      }
      for (const [file, uses] of filenameUses) {
        if (
          uses.filenameSensitive ||
          [...uses.preloads].some((preload) => !verifiedPreloads.has(preload))
        )
          hashes.set(file, digest(JSON.stringify([hashes.get(file), file])));
      }
      if (storyFiles.size !== stories.size) throw new Error('unrecognized-story-loader');
      const globalFiles = new Set<string>();
      const collect = (roots: string[]) => {
        const found = new Set<string>();
        const queue = [...roots];
        while (queue.length) {
          const file = queue.pop()!;
          if (found.has(file)) continue;
          found.add(file);
          if (hashes.has(`${file}.map`)) found.add(`${file}.map`);
          for (const edge of graph.get(file) ?? []) if (!edge.story) queue.push(edge.file);
        }
        return found;
      };
      for (const file of collect(
        chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName)
      ))
        globalFiles.add(file);
      const owned = new Set(globalFiles);
      const perStory = new Map<string, Set<string>>();
      for (const [story, file] of storyFiles) {
        const files = collect([file]);
        perStory.set(story, files);
        for (const ownedFile of files) owned.add(ownedFile);
      }
      for (const file of graph.keys())
        if (!owned.has(file)) for (const dependency of collect([file])) globalFiles.add(dependency);
      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || !output.fileName.endsWith('.html')) continue;
        const html = canonicalizeTurbosnapHtml(String(output.source), output.fileName, identities);
        hashes.set(output.fileName, digest(html.code));
        for (const file of collect(html.dependencies)) globalFiles.add(file);
        identities.set(output.fileName, output.fileName);
        globalFiles.add(output.fileName);
        raw[output.fileName] = digest(output.source);
      }
      const fingerprint = (files: Set<string>) =>
        digest(
          JSON.stringify(
            [...files]
              .map((file) => [identities.get(file), hashes.get(file)])
              .sort(([a], [b]) => String(a).localeCompare(String(b)))
          )
        );
      this.draft = {
        ...this.draft,
        status: 'complete',
        reason: 'verified-preview-output',
        outputFiles: raw,
        globalOutputHash: fingerprint(globalFiles),
        storyOutputHashes: Object.fromEntries(
          [...perStory].map(([story, files]) => [story, fingerprint(files)])
        ),
      };
    } catch (error) {
      this.draft = {
        ...this.draft,
        status: 'incomplete',
        reason: error instanceof Error ? error.message : 'unsupported-output',
      };
    }
  }

  finish() {
    return this.draft;
  }
}
