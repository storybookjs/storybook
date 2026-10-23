import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

import { canonicalizeTurbosnapHtml, normalizeStories } from 'storybook/internal/common';
import { type ESTree, parseModule, walk } from 'storybook/internal/csf-tools';
import type { Options, TurbosnapOutputDraft } from 'storybook/internal/types';

import { toImportFn } from '@storybook/core-webpack';

import { join, relative, resolve } from 'pathe';
import type { Chunk, Compilation, Module } from 'webpack';

import { version } from '../package.json';

import {
  hasRecognizedWebpackStoryLoader,
  hasWebpackFilenameObservation,
} from './turbosnap-story-loader.ts';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const digest = (values: Iterable<string>) => hash(JSON.stringify([...values].sort()));

class IncompleteWebpackOutput extends Error {}

type Reference = { identity: string; contentHash: string };
type Replacement = { start: number; end: number; value: string };

function replace(source: string, replacements: Replacement[]) {
  let result = source;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, replacement.start) + replacement.value + result.slice(replacement.end);
  }
  return result;
}

function canonicalFilename(filename: string, reference: Reference) {
  const offset = filename.indexOf(reference.contentHash);
  if (
    !/^[a-f\d]{8,}$/i.test(reference.contentHash) ||
    offset < 0 ||
    filename.indexOf(reference.contentHash, offset + 1) !== -1
  ) {
    throw new IncompleteWebpackOutput('unsupported-webpack-filename');
  }
  return (
    filename.slice(0, offset) +
    `__turbosnap_${reference.identity}__` +
    filename.slice(offset + reference.contentHash.length)
  );
}

export function canonicalizeWebpackRuntime(
  source: string,
  references: ReadonlyMap<string, Reference>,
  expected: ReadonlyMap<string, string>
) {
  const parsed = parseModule(source, 'runtime.js');
  if (parsed.code !== source) {
    throw new IncompleteWebpackOutput('unsupported-webpack-runtime-line-endings');
  }
  const assignments: ESTree.AssignmentExpression[] = [];
  walk(parsed.program, (node) => {
    if (
      node.type === 'AssignmentExpression' &&
      node.operator === '=' &&
      node.left.type === 'MemberExpression' &&
      !node.left.computed &&
      node.left.object.type === 'Identifier' &&
      node.left.object.name === '__webpack_require__' &&
      node.left.property.type === 'Identifier' &&
      node.left.property.name === 'u'
    ) {
      assignments.push(node);
    }
  });
  if (assignments.length !== 1) {
    throw new IncompleteWebpackOutput('unsupported-webpack-runtime-assignment');
  }
  const fn = assignments[0].right;
  if (
    (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') ||
    fn.async ||
    fn.generator ||
    !fn.body ||
    fn.params.length !== 1 ||
    fn.params[0].type !== 'Identifier'
  ) {
    throw new IncompleteWebpackOutput('unsupported-webpack-runtime-function');
  }
  const parameter = fn.params[0].name;
  const replacements: Replacement[] = [];
  const seen = new Set<string>();
  const readCondition = (node: ESTree.Expression) => {
    if (node.type !== 'BinaryExpression' || node.operator !== '===') {
      throw new IncompleteWebpackOutput('unsupported-webpack-runtime-condition');
    }
    const literal =
      node.left.type === 'Identifier' && node.left.name === parameter
        ? node.right
        : node.right.type === 'Identifier' && node.right.name === parameter
          ? node.left
          : undefined;
    if (
      literal?.type !== 'Literal' ||
      (typeof literal.value !== 'string' && typeof literal.value !== 'number')
    ) {
      throw new IncompleteWebpackOutput('unsupported-webpack-runtime-chunk-id');
    }
    return String(literal.value);
  };
  const readFilename = (node: ESTree.Expression, id: string) => {
    if (node.type !== 'Literal' || typeof node.value !== 'string') {
      throw new IncompleteWebpackOutput('unsupported-webpack-runtime-filename');
    }
    const reference = references.get(node.value);
    if (!reference || expected.get(id) !== node.value || seen.has(id)) {
      throw new IncompleteWebpackOutput('unbound-webpack-runtime-reference');
    }
    seen.add(id);
    replacements.push({
      start: node.start,
      end: node.end,
      value: JSON.stringify(canonicalFilename(node.value, reference)),
    });
  };
  const isUndefined = (node: ESTree.Expression) =>
    (node.type === 'Identifier' && node.name === 'undefined') ||
    (node.type === 'UnaryExpression' &&
      node.operator === 'void' &&
      node.argument.type === 'Literal' &&
      node.argument.value === 0);
  if (fn.body.type === 'BlockStatement') {
    const statements = fn.body.body;
    for (const [index, statement] of statements.entries()) {
      if (
        statement.type === 'IfStatement' &&
        !statement.alternate &&
        statement.consequent.type === 'ReturnStatement' &&
        statement.consequent.argument
      ) {
        readFilename(statement.consequent.argument, readCondition(statement.test));
      } else if (
        index !== statements.length - 1 ||
        statement.type !== 'ReturnStatement' ||
        !statement.argument ||
        !isUndefined(statement.argument)
      ) {
        throw new IncompleteWebpackOutput('unsupported-webpack-runtime-statements');
      }
    }
  } else {
    let expression = fn.body;
    while (expression.type === 'ConditionalExpression') {
      readFilename(expression.consequent, readCondition(expression.test));
      expression = expression.alternate;
    }
    if (!isUndefined(expression)) {
      throw new IncompleteWebpackOutput('unsupported-webpack-runtime-default');
    }
  }
  if (seen.size !== expected.size) {
    throw new IncompleteWebpackOutput('incomplete-webpack-runtime-references');
  }
  return replace(source, replacements);
}

function moduleStructure(source: string) {
  return JSON.stringify(parseModule(source, 'storybook-stories.js').program, (key, value) =>
    ['start', 'end', 'loc', 'raw'].includes(key) ? undefined : value
  );
}

function modulePath(module: Module) {
  return module.nameForCondition();
}

function isModule(value: unknown): value is Module {
  return (
    typeof value === 'object' &&
    value !== null &&
    'identifier' in value &&
    typeof value.identifier === 'function' &&
    'nameForCondition' in value &&
    typeof value.nameForCondition === 'function'
  );
}

function members(module: Module): Module[] {
  if ('modules' in module && Array.isArray(module.modules)) {
    return module.modules.filter(isModule).flatMap(members);
  }
  return [module];
}

function canonicalSourceMap(
  source: string,
  filename: string,
  identity: string,
  runtime: boolean,
  references: ReadonlyMap<string, Reference>,
  expected: ReadonlyMap<string, string>
) {
  const parsed = parseModule(`(${source})`, 'map.js');
  if (parsed.code !== `(${source})`) {
    throw new IncompleteWebpackOutput('unsupported-webpack-source-map-line-endings');
  }
  const statement = parsed.program.body[0];
  if (
    statement?.type !== 'ExpressionStatement' ||
    statement.expression.type !== 'ObjectExpression'
  ) {
    throw new IncompleteWebpackOutput('unsupported-webpack-source-map');
  }
  const values = new Map<string, ESTree.Expression>();
  for (const property of statement.expression.properties) {
    if (
      property.type === 'Property' &&
      property.key.type === 'Literal' &&
      typeof property.key.value === 'string'
    ) {
      values.set(property.key.value, property.value);
    }
  }
  const file = values.get('file');
  if (file?.type !== 'Literal' || file.value !== filename) {
    throw new IncompleteWebpackOutput('unbound-webpack-source-map');
  }
  const replacements: Replacement[] = [
    { start: file.start - 1, end: file.end - 1, value: JSON.stringify(identity) },
  ];
  if (runtime) {
    const sources = values.get('sources');
    const content = values.get('sourcesContent');
    if (sources?.type !== 'ArrayExpression' || content?.type !== 'ArrayExpression') {
      throw new IncompleteWebpackOutput('unsupported-webpack-runtime-source-map');
    }
    let found = false;
    for (const [index, entry] of sources.elements.entries()) {
      if (
        entry?.type === 'Literal' &&
        typeof entry.value === 'string' &&
        entry.value.endsWith('/webpack/runtime/get javascript chunk filename')
      ) {
        const value = content.elements[index];
        if (found || value?.type !== 'Literal' || typeof value.value !== 'string') {
          throw new IncompleteWebpackOutput('unsupported-webpack-runtime-source-map-content');
        }
        found = true;
        replacements.push({
          start: value.start - 1,
          end: value.end - 1,
          value: JSON.stringify(canonicalizeWebpackRuntime(value.value, references, expected)),
        });
      }
    }
    if (!found) {
      throw new IncompleteWebpackOutput('missing-webpack-runtime-source-map');
    }
  }
  return replace(source, replacements);
}

function sourceMapComment(source: string, map: string, identity: string) {
  const marker = `\n//# sourceMappingURL=${map}`;
  const start = source.lastIndexOf(marker);
  if (start === -1) {
    return source;
  }
  const end = start + marker.length;
  if (source.slice(end).trim()) {
    throw new IncompleteWebpackOutput('unsupported-webpack-source-map-comment');
  }
  return source.slice(0, start) + `\n//# sourceMappingURL=${identity}.map` + source.slice(end);
}

export async function createWebpackOutputEvidence(
  compilation: Compilation,
  options: Options
): Promise<TurbosnapOutputDraft> {
  const builder: TurbosnapOutputDraft['builder'] = { name: '@storybook/builder-webpack5', version };
  try {
    return await collectWebpackOutput(compilation, options, builder);
  } catch (error) {
    return {
      status: 'incomplete',
      reason: error instanceof Error ? error.message : 'webpack-output-unavailable',
      builder,
      outputFiles: {},
      globalOutputHash: '',
      storyOutputHashes: {},
    };
  }
}

async function collectWebpackOutput(
  compilation: Compilation,
  options: Options,
  builder: TurbosnapOutputDraft['builder']
): Promise<TurbosnapOutputDraft> {
  const cwd = process.cwd();
  const storySpecs = normalizeStories(await options.presets.apply('stories', []), {
    configDir: options.configDir,
    workingDir: cwd,
  });
  const storyLoader = resolve(cwd, 'storybook-stories.js');
  const generatedStoryLoader = moduleStructure(
    toImportFn(storySpecs, { needPipelinedImport: false })
  );
  const recognizedStoryLoaders = new Set<Module>();
  const { chunkGraph, moduleGraph } = compilation;
  const chunks = [...compilation.chunks];
  const identities = new Map<Chunk, string>();
  const references = new Map<string, Reference>();
  const chunkFiles = new Map<Chunk, string>();
  const owners = new Map<Module, Set<Chunk>>();
  const stories = new Map<string, Module>();
  for (const chunk of chunks) {
    const chunkModules = [...chunkGraph.getChunkModulesIterable(chunk)];
    const sourceModules = chunkModules.flatMap(members);
    const identity = hash(
      JSON.stringify({
        name: chunk.name,
        modules: sourceModules
          .map((module) => module.libIdent({ context: cwd }) ?? module.identifier())
          .sort(),
        runtime: [...chunkGraph.getChunkRuntimeModulesIterable(chunk)]
          .map((module) => module.identifier())
          .sort(),
      })
    );
    if ([...identities.values()].includes(identity)) {
      throw new IncompleteWebpackOutput('ambiguous-webpack-chunk-identity');
    }
    identities.set(chunk, identity);
    for (const module of [...chunkModules, ...sourceModules]) {
      const set = owners.get(module) ?? new Set<Chunk>();
      set.add(chunk);
      owners.set(module, set);
      const path = modulePath(module);
      if (path === storyLoader && module.originalSource()) {
        try {
          if (
            moduleStructure(module.originalSource()!.source().toString()) === generatedStoryLoader
          ) {
            recognizedStoryLoaders.add(module);
          }
        } catch {
          // Unrecognized transforms keep all of their story dependencies global.
        }
      }
      if (
        path &&
        storySpecs.some((specifier) => specifier.importPathMatcher.test(`./${relative(cwd, path)}`))
      ) {
        stories.set(`./${relative(cwd, path)}`, module);
      }
    }
    const files = [...chunk.files].filter((file) => /\.[cm]?js$/.test(file));
    if (files.length !== 1) {
      throw new IncompleteWebpackOutput('unsupported-webpack-chunk-files');
    }
    const file = files[0];
    const contentHash = compilation.getAsset(file)?.info.contenthash;
    if (typeof contentHash !== 'string') {
      throw new IncompleteWebpackOutput('missing-webpack-content-hash');
    }
    references.set(file, { identity, contentHash });
    chunkFiles.set(chunk, file);
  }
  if (!stories.size) {
    throw new IncompleteWebpackOutput('missing-webpack-story-outputs');
  }
  const reachable = (roots: Iterable<Module>, skipStoryLoader: boolean) => {
    const seen = new Map<Module, Set<Chunk | undefined>>();
    const pending: { module: Module; chunk?: Chunk }[] = [...roots].map((module) => ({ module }));
    const result = new Set<Chunk>();
    while (pending.length) {
      const { module, chunk } = pending.pop()!;
      const visited = seen.get(module) ?? new Set<Chunk | undefined>();
      if (visited.has(chunk)) {
        continue;
      }
      visited.add(chunk);
      seen.set(module, visited);
      const moduleOwners = owners.get(module);
      // Webpack may duplicate the same module in several independent story chunks.
      // The copy already present in this chunk does not load those other chunks.
      const activeChunks =
        chunk && moduleOwners?.has(chunk)
          ? [chunk]
          : moduleOwners?.size
            ? [...moduleOwners]
            : [chunk];
      for (const active of activeChunks) {
        if (active) result.add(active);
        for (const member of members(module)) {
          if (member !== module) pending.push({ module: member, chunk: active });
        }
        for (const connection of moduleGraph.getOutgoingConnections(module)) {
          if (
            skipStoryLoader &&
            recognizedStoryLoaders.has(connection.resolvedOriginModule ?? module) &&
            connection.dependency?.type === 'import() context lazy'
          ) {
            continue;
          }
          if (connection.resolvedModule) {
            pending.push({ module: connection.resolvedModule, chunk: active });
          }
        }
      }
    }
    return result;
  };
  const entryModules = chunks.flatMap((chunk) => [
    ...chunkGraph.getChunkEntryModulesIterable(chunk),
  ]);
  const globalChunks = reachable(entryModules, true);
  for (const chunk of chunks) {
    if (chunk.hasRuntime()) {
      globalChunks.add(chunk);
    }
  }
  const storyChunks = new Map(
    [...stories].map(([path, module]) => [path, reachable([module], false)])
  );
  for (const chunk of chunks) {
    if (![...storyChunks.values()].some((set) => set.has(chunk))) {
      globalChunks.add(chunk);
    }
  }
  if (recognizedStoryLoaders.size) {
    const contextIds = new Set<string | number>();
    for (const module of recognizedStoryLoaders) {
      for (const connection of moduleGraph.getOutgoingConnections(module)) {
        if (connection.dependency?.type === 'import() context lazy' && connection.resolvedModule) {
          const id = chunkGraph.getModuleId(connection.resolvedModule);
          if (id !== null) contextIds.add(id);
        }
      }
    }
    const sources = [...globalChunks].map((chunk) =>
      compilation.getAsset(chunkFiles.get(chunk)!)!.source.source().toString()
    );
    if (!hasRecognizedWebpackStoryLoader(compilation, sources, storySpecs, contextIds)) {
      throw new IncompleteWebpackOutput('unrecognized-webpack-final-story-loader');
    }
  }
  const outputFiles: Record<string, string> = {};
  const chunkHashes = new Map<Chunk, string>();
  const filenameObservers = new Set<Chunk>();
  const readAsset = (file: string) => {
    const asset = compilation.getAsset(file);
    if (!asset) {
      throw new IncompleteWebpackOutput('missing-webpack-output-file');
    }
    const value = asset.source.source();
    outputFiles[file] = hash(value);
    return value.toString();
  };
  for (const chunk of chunks) {
    const file = chunkFiles.get(chunk)!;
    const identity = identities.get(chunk)!;
    const expected = new Map<string, string>();
    for (const child of chunk.getAllAsyncChunks()) {
      const childFile = chunkFiles.get(child);
      if (child.id === null || !childFile) {
        throw new IncompleteWebpackOutput('unbound-webpack-async-chunk');
      }
      expected.set(String(child.id), childFile);
    }
    const runtime = chunk.hasRuntime() && expected.size > 0;
    if (
      runtime &&
      [...chunkGraph.getChunkModulesIterable(chunk)].some((module) => module.type !== 'runtime')
    ) {
      throw new IncompleteWebpackOutput('unsupported-webpack-inline-runtime');
    }
    let source = readAsset(file);
    if (hasWebpackFilenameObservation(compilation, source)) filenameObservers.add(chunk);
    if (runtime) {
      source = canonicalizeWebpackRuntime(source, references, expected);
    }
    const related = compilation.getAsset(file)?.info.related;
    const hashes: string[] = [];
    for (const [kind, assetFile] of Object.entries(related ?? {})) {
      if (typeof assetFile !== 'string' || (kind !== 'sourceMap' && kind !== 'license')) {
        throw new IncompleteWebpackOutput('unsupported-webpack-related-output');
      }
      let assetSource = readAsset(assetFile);
      if (kind === 'sourceMap') {
        source = sourceMapComment(source, assetFile, identity);
        assetSource = canonicalSourceMap(
          assetSource,
          file,
          identity,
          runtime,
          references,
          expected
        );
      }
      hashes.push(`${kind}:${hash(assetSource)}`);
    }
    hashes.push(`javascript:${hash(source)}`);
    chunkHashes.set(chunk, `${identity}:${digest(hashes)}`);
  }
  const globalHashes: string[] = [];
  if (filenameObservers.size) {
    const callers = new Set(filenameObservers);
    const seen = new Set<Module>();
    const pending = [...filenameObservers].flatMap((chunk) =>
      [...chunkGraph.getChunkModulesIterable(chunk)].flatMap((module) => [
        module,
        ...members(module),
      ])
    );
    while (pending.length) {
      const module = pending.pop()!;
      if (seen.has(module)) continue;
      seen.add(module);
      for (const connection of moduleGraph.getIncomingConnections(module)) {
        for (const caller of [connection.originModule, connection.resolvedOriginModule]) {
          if (!caller) continue;
          for (const owner of owners.get(caller) ?? []) callers.add(owner);
          pending.push(caller);
        }
      }
    }
    globalHashes.push(
      `observed-filenames:${digest([...callers].map((chunk) => chunkFiles.get(chunk)!))}`
    );
  }
  const html = compilation.getAsset('iframe.html');
  if (html) {
    const source = readAsset('iframe.html');
    const diskAssets = new Map<string, string>();
    const collectDiskAssets = async (root: string, directory = root) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) await collectDiskAssets(root, file);
        else if (entry.isFile()) diskAssets.set(relative(root, file), file);
      }
    };
    if (options.outputDir) await collectDiskAssets(options.outputDir);
    const htmlReferences = new Map([
      ...[...diskAssets.keys(), ...compilation.getAssets().map(({ name }) => name)].map(
        (file): [string, string] => [file, file]
      ),
      ...[...references].map(([file, value]): [string, string] => [file, value.identity]),
    ]);
    const canonical = await canonicalizeTurbosnapHtml(source, 'iframe.html', htmlReferences);
    for (const file of canonical.dependencies) {
      const chunk = chunks.find((candidate) => chunkFiles.get(candidate) === file);
      if (!chunk) {
        const diskFile = diskAssets.get(file);
        if (compilation.getAsset(file)) readAsset(file);
        else if (diskFile) outputFiles[file] = hash(await readFile(diskFile));
        else throw new IncompleteWebpackOutput('unbound-webpack-html-reference');
        globalHashes.push(`html-resource:${file}:${outputFiles[file]}`);
        continue;
      }
      if (!globalChunks.has(chunk)) {
        globalChunks.add(chunk);
        for (const dependency of reachable(chunkGraph.getChunkModulesIterable(chunk), false)) {
          globalChunks.add(dependency);
        }
      }
    }
    globalHashes.push(`iframe.html:${hash(canonical.code)}`);
  }
  globalHashes.push(...[...globalChunks].map((chunk) => chunkHashes.get(chunk)!));
  return {
    status: 'complete',
    reason: 'webpack-final-output',
    builder,
    outputFiles,
    globalOutputHash: digest(globalHashes),
    storyOutputHashes: Object.fromEntries(
      [...storyChunks].map(([path, set]) => [
        path,
        digest([...set].map((chunk) => chunkHashes.get(chunk)!)),
      ])
    ),
  };
}
