// Resolves a story's args statically: named properties, spreads of other stories' args (in this
// file or another), and the literal values the generated bindings inline.
import { babelPrint, types as t } from 'storybook/internal/babel';
import type { CsfFile } from 'storybook/internal/csf-tools';
import { keyOf, unwrapExpression } from 'storybook/internal/csf-tools';

import type { SnippetEnum } from './build-docgen.ts';
import { parseStoryFile } from './resolve-component.ts';
import {
  isBindCall,
  isStoryFactoryCall,
  keyNameOf,
  resolvedProperty,
  sourceOf,
} from './story-docs-markup.ts';
import { isValidIdentifier } from '../template-grammar.ts';

export interface ArgsRecord {
  properties: Record<string, t.Node>;
  complete: boolean;
  /** Source text of every member `properties` could not absorb; empty exactly when complete. */
  unresolved: string[];
}

/** Named properties of an `args` object literal, and whether the record is statically complete. */
export const argsProperties = (
  node: t.Node | undefined,
  resolveSpread?: SpreadResolver
): ArgsRecord => {
  const properties: Record<string, t.Node> = {};
  if (node === undefined) {
    return { properties, complete: true, unresolved: [] };
  }
  const unwrapped = unwrapExpression(node);
  if (!t.isObjectExpression(unwrapped)) {
    return { properties, complete: false, unresolved: [`args: ${sourceOf(unwrapped)}`] };
  }

  const unresolved: string[] = [];
  for (const property of unwrapped.properties) {
    if (t.isSpreadElement(property)) {
      const spreadIn = resolveSpread?.(property);
      if (spreadIn === undefined || !spreadIn.complete) {
        unresolved.push(sourceOf(property));
        continue;
      }
      Object.assign(properties, spreadIn.properties);
      continue;
    }
    const key = t.isObjectProperty(property) ? keyNameOf(property) : undefined;
    if (!t.isObjectProperty(property) || key === undefined) {
      // An accessor or dynamic key can add or override args this pass cannot see.
      unresolved.push(sourceOf(property));
      continue;
    }
    properties[key] = property.value;
  }
  return { properties, complete: unresolved.length === 0, unresolved };
};

type SpreadResolver = (spread: t.SpreadElement) => ArgsRecord | undefined;

export interface SpreadArgsContext {
  csf: CsfFile;
  filePath: string;
  enums: SnippetEnum[];
  resolveImport: (fromFile: string, specifier: string) => string | undefined;
}

/** How a spread reads another story's args, matching the story's declared form. */
type ArgsAccessor = 'args' | 'input.args';

const accessorOf = (path: readonly string[]): ArgsAccessor | undefined => {
  if (path.length === 1 && path[0] === 'args') {
    return 'args';
  }
  return path.length === 2 && path[0] === 'input' && path[1] === 'args' ? 'input.args' : undefined;
};

/**
 * Resolves `...Primary.args` (and the factory form `...Primary.input.args`) to the args the spread
 * copies at module-evaluation time, following the reference into another story file when the story
 * is imported. Anything it cannot pin down leaves the args record incomplete, so the story yields
 * no snippet rather than a fabricated one.
 */
export const createSpreadArgsResolver =
  (ctx: SpreadArgsContext, visited = new Set<string>()): SpreadResolver =>
  (spread) => {
    const chain = memberChain(spread.argument);
    if (!chain) {
      return undefined;
    }
    const { root, path } = chain;

    if (path.length === 0) {
      return moduleConstantArgs(ctx, root, spread.start ?? undefined, visited);
    }

    if (ctx.csf._storyExports[root] || ctx.csf._storyStatements[root]) {
      return spread.start == null
        ? undefined
        : storyArgsAt(ctx, root, accessorOf(path), spread.start, visited);
    }

    const imported = importBindingOf(ctx.csf, root);
    if (!imported) {
      return undefined;
    }
    const [storyName, accessorPath] =
      imported.kind === 'namespace'
        ? [path[0], path.slice(1)]
        : [imported.exportName, path as string[]];
    if (storyName === undefined) {
      return undefined;
    }
    const targetPath = ctx.resolveImport(ctx.filePath, imported.importId);
    const target = targetPath === undefined ? undefined : parseStoryFile(targetPath, 'StoryDocs');
    if (!target) {
      return undefined;
    }
    const targetCtx: SpreadArgsContext = { ...ctx, csf: target, filePath: targetPath! };
    const record = storyArgsAt(targetCtx, storyName, accessorOf(accessorPath), undefined, visited);
    if (record === undefined || !record.complete) {
      return undefined;
    }
    // A binding the snippet prints names nothing outside itself, so an arg copied from another
    // file may only join this record once it reduces to a value that stands on its own.
    const properties: Record<string, t.Node> = {};
    for (const [key, node] of Object.entries(record.properties)) {
      const value = evaluateNode(node, ctx.enums);
      if (value === EVAL_FAILED) {
        return undefined;
      }
      properties[key] = t.valueToNode(value);
    }
    return { properties, complete: true, unresolved: [] };
  };

/** A bare `...base` spread of a module-level constant object, read from its initializer. */
const moduleConstantArgs = (
  ctx: SpreadArgsContext,
  name: string,
  position: number | undefined,
  visited: Set<string>
): ArgsRecord | undefined => {
  if (position === undefined) {
    return undefined;
  }
  const binding = ctx.csf._file.path.scope.getBinding(name);
  if (!binding?.constant || !t.isVariableDeclarator(binding.path.node)) {
    return undefined;
  }
  const init = binding.path.node.init;
  if (!init || !t.isObjectExpression(unwrapExpression(init))) {
    return undefined;
  }
  if (
    (binding.path.node.start ?? Number.POSITIVE_INFINITY) > position ||
    hasAssignmentInto(ctx.csf, name, 1, position)
  ) {
    return undefined;
  }
  return argsProperties(init, createSpreadArgsResolver(ctx, visited));
};

/** A member chain of statically-known keys, like `HeaderStories.LoggedIn.input.args`. */
const memberChain = (node: t.Node): { root: string; path: string[] } | undefined => {
  const path: string[] = [];
  let current = unwrapExpression(node);
  while (t.isMemberExpression(current)) {
    const key =
      t.isIdentifier(current.property) && !current.computed
        ? current.property.name
        : t.isStringLiteral(current.property)
          ? current.property.value
          : undefined;
    if (key === undefined) {
      return undefined;
    }
    path.unshift(key);
    current = unwrapExpression(current.object);
  }
  return t.isIdentifier(current) ? { root: current.name, path } : undefined;
};

type StoryImportBinding =
  | { kind: 'named'; importId: string; exportName: string }
  | { kind: 'namespace'; importId: string };

const importBindingOf = (csf: CsfFile, localName: string): StoryImportBinding | undefined => {
  for (const statement of csf._file.path.node.body) {
    if (!t.isImportDeclaration(statement) || statement.importKind === 'type') {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.local.name !== localName) {
        continue;
      }
      const importId = statement.source.value;
      if (t.isImportNamespaceSpecifier(specifier)) {
        return { kind: 'namespace', importId };
      }
      if (t.isImportSpecifier(specifier) && specifier.importKind !== 'type') {
        return {
          kind: 'named',
          importId,
          exportName: t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value,
        };
      }
      return undefined;
    }
  }
  return undefined;
};

/** How a story export declares itself, deciding which accessor reads its args at runtime. */
type StoryForm =
  | { kind: 'object'; config: t.ObjectExpression }
  | {
      kind: 'factory';
      method: 'story' | 'extend';
      call: t.CallExpression;
      config: t.ObjectExpression;
    }
  | { kind: 'function' };

const storyFormOf = (csf: CsfFile, exportName: string): StoryForm | undefined => {
  const declared = csf._storyExports[exportName];
  const candidates = [
    t.isVariableDeclarator(declared) ? declared.init : declared,
    csf._storyStatements[exportName],
  ];
  for (const candidate of candidates) {
    const unwrapped = candidate ? unwrapExpression(candidate) : undefined;
    if (!unwrapped) {
      continue;
    }
    if (t.isObjectExpression(unwrapped)) {
      return { kind: 'object', config: unwrapped };
    }
    if (t.isCallExpression(unwrapped) && isStoryFactoryCall(unwrapped)) {
      const method = ((unwrapped.callee as t.MemberExpression).property as t.Identifier).name as
        | 'story'
        | 'extend';
      const argument = unwrapped.arguments[0];
      const config = argument && unwrapExpression(argument);
      return config && t.isObjectExpression(config)
        ? { kind: 'factory', method, call: unwrapped, config }
        : undefined;
    }
    if (
      t.isArrowFunctionExpression(unwrapped) ||
      t.isFunctionExpression(unwrapped) ||
      t.isFunctionDeclaration(unwrapped) ||
      (t.isCallExpression(unwrapped) && isBindCall(unwrapped))
    ) {
      return { kind: 'function' };
    }
  }
  return undefined;
};

/**
 * The args a spread of this story's args object copies, as of `position` in the same file, or the
 * module's final state when `position` is `undefined` (a cross-file reference).
 *
 * `undefined` whenever the value at that moment cannot be pinned down: the story is declared after
 * the spread runs, a member assignment lands in between, or something mutates the args object.
 */
const storyArgsAt = (
  ctx: SpreadArgsContext,
  exportName: string,
  accessor: ArgsAccessor | undefined,
  position: number | undefined,
  visited: Set<string>
): ArgsRecord | undefined => {
  if (accessor === undefined) {
    return undefined;
  }
  const key = `${ctx.filePath}#${exportName}`;
  if (visited.has(key)) {
    return undefined;
  }
  visited.add(key);
  try {
    return unguardedStoryArgsAt(ctx, exportName, accessor, position, visited);
  } finally {
    visited.delete(key);
  }
};

const unguardedStoryArgsAt = (
  ctx: SpreadArgsContext,
  exportName: string,
  accessor: ArgsAccessor,
  position: number | undefined,
  visited: Set<string>
): ArgsRecord | undefined => {
  const { csf } = ctx;
  const declarationStart = (csf._storyStatements[exportName] ?? csf._storyExports[exportName])
    ?.start;
  if (position !== undefined && (declarationStart == null || declarationStart > position)) {
    return undefined;
  }
  if (hasAssignmentInto(csf, exportName, 2, position)) {
    return undefined;
  }

  const form = storyFormOf(csf, exportName);
  if (form === undefined || (form.kind === 'factory') !== (accessor === 'input.args')) {
    return undefined;
  }

  const resolver = createSpreadArgsResolver(ctx, visited);
  const own =
    form.kind === 'function' ? { kind: 'missing' as const } : resolvedProperty(form.config, 'args');
  if (own.kind === 'unresolvable') {
    return undefined;
  }
  const ownNode = own.kind === 'value' ? own.node : undefined;

  const annotated = csf._storyAnnotations[exportName]?.args;
  // An annotation node the declaration does not contain is an `X.args = {...}` assignment; the
  // spread copies it only when the assignment has already run.
  const argsNode =
    annotated !== undefined && annotated !== ownNode
      ? position === undefined || (annotated.start != null && annotated.start < position)
        ? annotated
        : ownNode
      : ownNode;
  const record = argsProperties(argsNode, resolver);

  if (form.kind === 'factory' && form.method === 'extend') {
    const parent = unwrapExpression((form.call.callee as t.MemberExpression).object);
    const parentName = t.isIdentifier(parent) ? parent.name : undefined;
    const isStory =
      parentName !== undefined &&
      (csf._storyExports[parentName] !== undefined ||
        csf._storyStatements[parentName] !== undefined);
    if (!isStory) {
      return undefined;
    }
    const parentRecord = storyArgsAt(ctx, parentName!, 'input.args', position, visited);
    if (parentRecord === undefined) {
      return undefined;
    }
    return {
      properties: { ...parentRecord.properties, ...record.properties },
      complete: parentRecord.complete && record.complete,
      unresolved: [...parentRecord.unresolved, ...record.unresolved],
    };
  }
  return record;
};

/** Whether a top-level statement assigns into `name` at least `minDepth` member levels deep. */
export const hasAssignmentInto = (
  csf: CsfFile,
  name: string,
  minDepth: number,
  position: number | undefined
): boolean => {
  for (const statement of csf._file.path.node.body) {
    if (!t.isExpressionStatement(statement) || !t.isAssignmentExpression(statement.expression)) {
      continue;
    }
    let target: t.Node = statement.expression.left;
    let depth = 0;
    while (t.isMemberExpression(target)) {
      depth += 1;
      target = target.object;
    }
    if (
      depth >= minDepth &&
      t.isIdentifier(target) &&
      target.name === name &&
      (position === undefined || (statement.start ?? 0) < position)
    ) {
      return true;
    }
  }
  return false;
};

// `Story.args = {...}` is read through the parser's annotations; only a deeper mutation like
// `Story.args.label = ...` changes args this pass cannot see.
export const deepAssignmentSources = (csf: CsfFile, name: string): string[] => {
  const sources: string[] = [];
  for (const statement of csf._file.path.node.body) {
    if (!t.isExpressionStatement(statement) || !t.isAssignmentExpression(statement.expression)) {
      continue;
    }
    let target: t.Node = statement.expression.left;
    let depth = 0;
    while (t.isMemberExpression(target)) {
      depth += 1;
      target = target.object;
    }
    if (depth >= 2 && t.isIdentifier(target) && target.name === name) {
      sources.push(sourceOf(statement.expression));
    }
  }
  return sources;
};

const EVAL_FAILED = Symbol('story-docs-eval-failed');

// An arg no static evaluation could reduce to a value falls back to its source text. Every
// expression is escaped for the attribute position it lands in: the double-quote delimiter and
// text Angular's lexer would decode as a character reference survive the round-trip unchanged.
export const evaluateArgExpression = (node: t.Node, enums: SnippetEnum[]): string => {
  const literal = evaluateArgLiteral(node, enums);
  return escapeAttributeExpression(literal ?? printArgSource(unwrapExpression(node)));
};

/**
 * The arg's value as a standalone expression, or `undefined` when it needs the story to run.
 *
 * Unlike {@link evaluateArgExpression} this never falls back to source text, so a caller that has
 * to produce code rather than an attribute can tell a real value from a name only the story file
 * knows. The two positions share a printer, so a value reads the same wherever it lands.
 */
export const evaluateArgLiteral = (node: t.Node, enums: SnippetEnum[]): string | undefined => {
  const value = evaluateNode(unwrapExpression(node), enums);
  return value === EVAL_FAILED ? undefined : printExpressionValue(value, new Set());
};

// recast reprints a node it parsed straight from the file's own text, comments and indentation
// included. A clone drops the bookkeeping that path relies on and is formatted from the AST
// instead, which is what leaves a binding holding the expression and nothing else.
const printArgSource = (node: t.Node): string => babelPrint(t.cloneNode(node, true));

// Angular expression strings support backslash escapes, so quoting stays lossless.
const quoteExpressionString = (value: string): string =>
  `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;

// Renders an evaluated arg as a template expression, in the same shape the runtime generator
// prints, but losslessly for strings carrying quotes.
const printExpressionValue = (value: unknown, seen: Set<unknown>): string => {
  if (typeof value === 'string') {
    return quoteExpressionString(value);
  }
  if (typeof value !== 'object' || value === null) {
    return `${value}`;
  }
  if (seen.has(value)) {
    return quoteExpressionString('[Circular]');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((element) => printExpressionValue(element ?? null, seen)).join(', ')}]`;
  }
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(
      ([key, entryValue]) =>
        `${isValidIdentifier(key) ? key : quoteExpressionString(key)}: ${printExpressionValue(entryValue, seen)}`
    );
  return `{${entries.join(', ')}}`;
};

const escapeAttributeExpression = (expression: string): string =>
  expression.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');

const evaluateNode = (node: t.Node, enums: SnippetEnum[]): unknown => {
  const unwrapped = unwrapExpression(node);
  if (
    t.isStringLiteral(unwrapped) ||
    t.isNumericLiteral(unwrapped) ||
    t.isBooleanLiteral(unwrapped)
  ) {
    return unwrapped.value;
  }
  if (t.isNullLiteral(unwrapped)) {
    return null;
  }
  if (t.isIdentifier(unwrapped) && unwrapped.name === 'undefined') {
    return undefined;
  }
  if (
    t.isUnaryExpression(unwrapped) &&
    unwrapped.operator === '-' &&
    t.isNumericLiteral(unwrapped.argument)
  ) {
    return -unwrapped.argument.value;
  }
  if (t.isTemplateLiteral(unwrapped) && unwrapped.expressions.length === 0) {
    return unwrapped.quasis[0]?.value.cooked ?? EVAL_FAILED;
  }
  if (t.isArrayExpression(unwrapped)) {
    const values: unknown[] = [];
    for (const element of unwrapped.elements) {
      if (element === null || t.isSpreadElement(element)) {
        return EVAL_FAILED;
      }
      const value = evaluateNode(element, enums);
      if (value === EVAL_FAILED) {
        return EVAL_FAILED;
      }
      values.push(value);
    }
    return values;
  }
  if (t.isObjectExpression(unwrapped)) {
    const value: Record<string, unknown> = {};
    for (const property of unwrapped.properties) {
      if (!t.isObjectProperty(property)) {
        return EVAL_FAILED;
      }
      const key = keyOf(property);
      if (key === null) {
        return EVAL_FAILED;
      }
      const propertyValue = evaluateNode(property.value, enums);
      if (propertyValue === EVAL_FAILED) {
        return EVAL_FAILED;
      }
      value[key] = propertyValue;
    }
    return value;
  }
  // `Enum.Member`: the analyzer collects referenced enums, so the member's value - what the
  // runtime generator would see - is recoverable statically.
  if (
    t.isMemberExpression(unwrapped) &&
    !unwrapped.computed &&
    t.isIdentifier(unwrapped.object) &&
    t.isIdentifier(unwrapped.property)
  ) {
    const objectName = unwrapped.object.name;
    const propertyName = unwrapped.property.name;
    const member = enums
      .find((enumeration) => enumeration.name === objectName)
      ?.members.find((candidate) => candidate.name === propertyName);
    return member?.value ?? EVAL_FAILED;
  }
  return EVAL_FAILED;
};
