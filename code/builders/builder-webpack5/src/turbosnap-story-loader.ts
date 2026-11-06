import type { NormalizedStoriesSpecifier } from 'storybook/internal/types';

import type { Compilation } from 'webpack';

type Node = Record<string, unknown> & { type: string };
const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string';
const named = (value: unknown, name: string) =>
  isNode(value) && value.type === 'Identifier' && value.name === name;
const structure = (value: unknown) =>
  JSON.stringify(value, (key, entry) => {
    if (['start', 'end', 'loc', 'range', 'raw'].includes(key)) return undefined;
    return key === 'type' && entry === 'FunctionDeclaration' ? 'FunctionExpression' : entry;
  });

function parseWebpackScript(compilation: Compilation, source: string) {
  const { JavascriptParser } = compilation.compiler.webpack.javascript;
  const normal = [...compilation.modules].find(
    (module) => module instanceof compilation.compiler.webpack.NormalModule
  );
  if (!normal) return undefined;
  const parser = new JavascriptParser('script');
  let result: unknown;
  parser.hooks.program.tap('StorybookTurbosnapLoader', (program) => {
    result = program;
    return true;
  });
  parser.parse(source, {
    source,
    current: normal,
    module: normal,
    compilation,
    options: compilation.options,
  });
  return result;
}

export function hasWebpackFilenameObservation(compilation: Compilation, source: string) {
  const visit = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(visit);
    if (!isNode(value)) return false;
    if (
      (value.type === 'Identifier' && value.name === 'currentScript') ||
      (value.type === 'Literal' && value.value === 'currentScript')
    )
      return true;
    return Object.values(value).some(visit);
  };
  return visit(parseWebpackScript(compilation, source));
}

export function hasRecognizedWebpackStoryLoader(
  compilation: Compilation,
  sources: string[],
  stories: NormalizedStoriesSpecifier[],
  contextIds: Set<string | number>
) {
  const parse = (source: string) => parseWebpackScript(compilation, source);
  const nodes: { node: Node; parent?: Node; source: number }[] = [];
  let sourceIndex = 0;
  const visit = (value: unknown, parent?: Node) => {
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, parent));
      return;
    }
    if (!isNode(value)) return;
    nodes.push({ node: value, parent, source: sourceIndex });
    Object.values(value).forEach((child) => visit(child, value));
  };
  for (const [index, source] of sources.entries()) {
    sourceIndex = index;
    visit(parse(source));
  }
  const identifiers = (name: string) => nodes.filter(({ node }) => named(node, name));
  const declarations = (name: string) =>
    nodes.filter(({ node }) => node.type === 'VariableDeclarator' && named(node.id, name));
  const importers = declarations('importers');
  const pipelines = declarations('pipeline').filter(
    (entry) => entry.source === importers[0]?.source
  );
  const functions = nodes.filter(
    ({ node }) =>
      ['FunctionExpression', 'FunctionDeclaration'].includes(node.type) &&
      named(node.id, 'importFn')
  );
  if (
    pipelines.length !== 1 ||
    importers.length !== 1 ||
    functions.length !== 1 ||
    identifiers('pipeline').filter((entry) => entry.source === importers[0]?.source).length !== 2 ||
    identifiers('importers').length !== 3
  )
    return false;
  const expression = (source: string) => {
    const program = parse(`const value = ${source};`);
    if (!isNode(program) || !Array.isArray(program.body)) return undefined;
    const declaration = program.body[0];
    if (!isNode(declaration) || !Array.isArray(declaration.declarations)) return undefined;
    const declarator = declaration.declarations[0];
    return isNode(declarator) ? declarator.init : undefined;
  };
  if (structure(pipelines[0].node.init) !== structure(expression('x => x()'))) return false;
  const fn = functions[0];
  const bodies = [
    'async function importFn(path) { for (let i=0; i<importers.length; i++) { const moduleExports=await pipeline(() => importers[i](path)); if (moduleExports) { return moduleExports; } } }',
    'async function importFn(path) { for (let i=0; i<importers.length; i++) { const moduleExports=await pipeline(() => importers[i](path)); if (moduleExports) return moduleExports; } }',
  ];
  if (!bodies.some((body) => structure(fn.node) === structure(expression(body)))) return false;
  const constructorUse = ({ node, parent }: { node: Node; parent?: Node }) =>
    parent?.type === 'NewExpression' &&
    Array.isArray(parent.arguments) &&
    parent.arguments[0] === node &&
    isNode(parent.callee) &&
    parent.callee.type === 'MemberExpression' &&
    named(parent.callee.property, 'PreviewWeb');
  if (fn.node.type === 'FunctionExpression') {
    if (identifiers('importFn').length !== 1 || !constructorUse(fn)) return false;
  } else {
    const references = identifiers('importFn').filter(({ parent }) => parent !== fn.node);
    if (references.length !== 1 || !constructorUse(references[0])) return false;
  }
  const array = importers[0].node.init;
  if (
    !isNode(array) ||
    array.type !== 'ArrayExpression' ||
    !Array.isArray(array.elements) ||
    array.elements.length !== stories.length ||
    contextIds.size !== stories.length
  )
    return false;
  const importerNodes = new Set<Node>();
  const collect = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (!isNode(value)) return;
    importerNodes.add(value);
    Object.values(value).forEach(collect);
  };
  collect(array);
  for (const { node, parent } of nodes) {
    if (
      node.type === 'Literal' &&
      (typeof node.value === 'string' || typeof node.value === 'number') &&
      contextIds.has(node.value) &&
      !importerNodes.has(node)
    ) {
      if (parent?.type === 'Property' && parent.key === node && !parent.computed) continue;
      if (
        parent?.type === 'AssignmentExpression' &&
        parent.operator === '=' &&
        parent.right === node &&
        isNode(parent.left) &&
        parent.left.type === 'MemberExpression' &&
        named(parent.left.object, 'webpackAsyncContext') &&
        named(parent.left.property, 'id') &&
        !parent.left.computed
      )
        continue;
      return false;
    }
  }
  const used = new Set<string | number>();
  for (const [index, importer] of array.elements.entries()) {
    const specifier = stories[index];
    const id = [...contextIds].find((candidate) => {
      if (used.has(candidate)) return false;
      return ['', 'compact'].some(
        (mode) =>
          structure(importer) ===
          structure(
            expression(
              `async path => { if (!${specifier.importPathMatcher}.exec(path)) ${mode ? 'return;' : '{ return; }'} const pathRemainder = path.substring(${specifier.directory.length + 1}); return __webpack_require__(${JSON.stringify(candidate)})("./" + pathRemainder); }`
            )
          )
      );
    });
    if (id === undefined) return false;
    used.add(id);
  }
  return true;
}
