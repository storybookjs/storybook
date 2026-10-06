// Reads an arg value written as a name through to the definition it refers to, and reports what
// printing the result still depends on.
import { type E, type Node, expressionFromSource, parseModule } from '../estree/ast.ts';
import { analyzeScopes } from '../estree/scope.ts';
import { type ImportRef } from './import-statements.ts';
import { type ImportBinding, collectImportBindings } from './imports.ts';
import { type ReferenceContext, codeOf, resolveArgsRecord } from './resolve-members.ts';
import { keyOf, unwrapExpression } from './utils.ts';

/** An arg value read through to the definition it names, and what printing it still depends on. */
export interface ResolvedArgValue {
  /** Node to print in place of what was written. */
  node: Node;
  /** Imports the printed node needs to resolve where the snippet lands. */
  imports: ImportRef[];
  /** Source text of every name the printed node depends on that no import can supply. */
  unresolved: string[];
}

/**
 * The value an arg node stands for, following a name to the definition it refers to.
 *
 * A name the story file declares resolves to the value it was declared with, since that name means
 * nothing where the snippet lands. A name another module owns stays as written and reports the
 * import that makes it resolve. Names a larger expression reaches for are reported the same way,
 * except that a locally declared one can only be named, not substituted into the expression.
 */
export const resolveArgValue = (node: Node, ctx: ReferenceContext): ResolvedArgValue => {
  const unresolved: string[] = [];
  const resolved = inlineSpreads(
    followValue(unwrapExpression(node), ctx, new Set()),
    ctx,
    unresolved
  );
  const bindings = importBindingsOf(ctx.editor.program);
  const imports: ImportRef[] = [];

  for (const name of freeNames(resolved)) {
    const imported = bindings.get(name);
    if (imported) {
      imports.push({
        localImportName: name,
        importId: imported.importId,
        importName: imported.importName,
        ...(imported.importName === '*' ? { namespace: name } : {}),
      });
      continue;
    }
    if (ctx.editor.scopes.program.bindings.has(name)) {
      unresolved.push(name);
    }
  }

  return { node: resolved, imports, unresolved };
};

/**
 * Whether printing a node needs no name from the scope it was written in.
 *
 * This is the bar a value copied out of another module has to clear, since the names that module
 * declares and imports mean nothing where the snippet lands.
 */
export const isSelfContained = (node: Node): boolean => freeNames(node).size === 0;

const importBindings = new WeakMap<E.Program, Map<string, ImportBinding>>();

const importBindingsOf = (program: E.Program): Map<string, ImportBinding> => {
  let bindings = importBindings.get(program);
  if (bindings === undefined) {
    bindings = collectImportBindings(program);
    importBindings.set(program, bindings);
  }
  return bindings;
};

/**
 * Writes out the spreads inside a value, so an arg holding an object shows what that object holds.
 *
 * A spread this pass cannot read leaves its object exactly as written: printing part of it would
 * claim the value is something it is not, where printing the source at least shows the story.
 */
const inlineSpreads = (node: Node, ctx: ReferenceContext, unresolved: string[]): Node => {
  // A value with nothing to pull in is returned as it was parsed, so it keeps the story's own
  // formatting rather than being reprinted from a rebuilt tree.
  if (!hasNamedSpread(node)) {
    return node;
  }

  if (node.type === 'ArrayExpression') {
    return rebuilt(
      `[${node.elements
        .map((element) =>
          element === null
            ? ''
            : element.type === 'SpreadElement'
              ? codeOf(element)
              : codeOf(inlineSpreads(element, ctx, unresolved))
        )
        .join(', ')}]`
    );
  }

  if (node.type !== 'ObjectExpression') {
    return node;
  }
  if (!node.properties.some((property) => property.type === 'SpreadElement')) {
    return objectFrom(node.properties as E.ObjectProperty[], ctx, unresolved) ?? node;
  }

  const members = resolveArgsRecord(node, ctx);
  if (members.unresolved.length > 0) {
    unresolved.push(...members.unresolved);
    return node;
  }
  return (
    objectFrom(
      Object.entries(members.properties).map(([key, value]) => ({ key, value })),
      ctx,
      unresolved
    ) ?? node
  );
};

// A node built from rewritten source; its parts print as written there.
const rebuilt = (code: string): Node => unwrapExpression(expressionFromSource(code));

/**
 * Whether a value spreads something it names rather than something written out on the spot.
 *
 * Only a named spread is worth writing out: `{ ...{ a: 1 }, b: 2 }` already says what it holds, so
 * rewriting it would reprint the story's own source for no gain.
 */
const hasNamedSpread = (node: Node): boolean => {
  if (node.type === 'ArrayExpression') {
    return node.elements.some(
      (element) => element !== null && element.type !== 'SpreadElement' && hasNamedSpread(element)
    );
  }
  return (
    node.type === 'ObjectExpression' &&
    node.properties.some((property) =>
      property.type === 'SpreadElement'
        ? unwrapExpression(property.argument).type !== 'ObjectExpression'
        : !property.method && property.kind === 'init' && hasNamedSpread(property.value)
    )
  );
};

const isValidIdentifier = (name: string) => /^[A-Za-z_$][\w$]*$/.test(name);

/** An object literal with every member value's own spreads written out, when they all can be. */
const objectFrom = (
  properties: (E.ObjectProperty | { key: string; value: Node })[],
  ctx: ReferenceContext,
  unresolved: string[]
): Node | undefined => {
  const members: string[] = [];
  for (const property of properties) {
    let key: string;
    let original: Node;
    if ('type' in property) {
      if (property.method || property.kind !== 'init') {
        return undefined;
      }
      const name = keyOf(property);
      key = property.computed
        ? `[${codeOf(property.key)}]`
        : name !== null && isValidIdentifier(name)
          ? name
          : codeOf(property.key);
      original = property.value;
    } else {
      if (property.value.type === 'Property') {
        return undefined;
      }
      key = isValidIdentifier(property.key) ? property.key : JSON.stringify(property.key);
      original = property.value;
    }
    const value = inlineSpreads(original, ctx, unresolved);
    // A shorthand prints its key and nothing else, so it may only stay shorthand while its value is
    // still the one the key stands for.
    const shorthand = 'type' in property && property.shorthand && value === property.value;
    members.push(shorthand ? key : `${key}: ${codeOf(value)}`);
  }
  // A rebuilt object is laid out one member per line, as the printer it replaces wrote it.
  return rebuilt(
    members.length === 0
      ? '{}'
      : `{\n${members.map((member) => `  ${member.replaceAll('\n', '\n  ')}`).join(',\n')}\n}`
  );
};

/** Reads a bare name through to the value it was declared with, as far as the chain goes. */
const followValue = (node: Node, ctx: ReferenceContext, seen: Set<string>): Node => {
  if (node.type !== 'Identifier' || seen.has(node.name)) {
    return node;
  }
  const binding = ctx.editor.scopes.program.bindings.get(node.name);
  if (
    !binding ||
    binding.kind === 'import' ||
    !binding.constant ||
    binding.node.type !== 'VariableDeclarator' ||
    !binding.node.init
  ) {
    return node;
  }
  seen.add(node.name);
  return followValue(unwrapExpression(binding.node.init), ctx, seen);
};

/**
 * Names an expression reaches for from outside itself. ES builtins count as resolved, since they
 * mean the same wherever the snippet lands.
 */
const freeNames = (node: Node): Set<string> => {
  if (node.type === 'Property') {
    return unboundNames(`({ ${codeOf(node)} })`);
  }
  return unboundNames(`(${codeOf(node)})`);
};

// Names every scope has, as Babel's `scope.hasBinding` counts them, so they never need an import.
const ES_BUILTINS = new Set([
  'AggregateError',
  'Array',
  'ArrayBuffer',
  'Atomics',
  'BigInt',
  'BigInt64Array',
  'BigUint64Array',
  'Boolean',
  'DataView',
  'Date',
  'Error',
  'EvalError',
  'FinalizationRegistry',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'Function',
  'Infinity',
  'Int16Array',
  'Int32Array',
  'Int8Array',
  'Intl',
  'Iterator',
  'JSON',
  'Map',
  'Math',
  'NaN',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'RangeError',
  'ReferenceError',
  'Reflect',
  'RegExp',
  'Set',
  'SharedArrayBuffer',
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'Uint16Array',
  'Uint32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'URIError',
  'WeakMap',
  'WeakRef',
  'WeakSet',
  'arguments',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'eval',
  'globalThis',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'undefined',
  'unescape',
]);

const unboundNames = (code: string) =>
  new Set(
    [...analyzeScopes(parseModule(code).program).unbound].filter((name) => !ES_BUILTINS.has(name))
  );
