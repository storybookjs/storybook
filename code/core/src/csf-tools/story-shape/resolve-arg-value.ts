// Reads an arg value written as a name through to the definition it refers to, and reports what
// printing the result still depends on.
import { type NodePath, traverse, types as t } from 'storybook/internal/babel';

import { type ImportRef } from './import-statements.ts';
import { type ImportBinding, collectImportBindings } from './imports.ts';
import { type ReferenceContext, resolveArgsRecord } from './resolve-members.ts';
import { unwrapExpression } from './utils.ts';

/** An arg value read through to the definition it names, and what printing it still depends on. */
export interface ResolvedArgValue {
  /** Node to print in place of what was written. */
  node: t.Node;
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
export const resolveArgValue = (node: t.Node, ctx: ReferenceContext): ResolvedArgValue => {
  const unresolved: string[] = [];
  const resolved = inlineSpreads(
    followValue(unwrapExpression(node), ctx, new Set()),
    ctx,
    unresolved
  );
  const bindings = importBindingsOf(ctx.program);
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
    if (ctx.program.scope.getBinding(name)) {
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
export const isSelfContained = (node: t.Node): boolean => freeNames(node).size === 0;

const importBindings = new WeakMap<t.Node, Map<string, ImportBinding>>();

const importBindingsOf = (program: NodePath<t.Program>): Map<string, ImportBinding> => {
  let bindings = importBindings.get(program.node);
  if (bindings === undefined) {
    bindings = collectImportBindings(program);
    importBindings.set(program.node, bindings);
  }
  return bindings;
};

/**
 * Writes out the spreads inside a value, so an arg holding an object shows what that object holds.
 *
 * A spread this pass cannot read leaves its object exactly as written: printing part of it would
 * claim the value is something it is not, where printing the source at least shows the story.
 */
const inlineSpreads = (node: t.Node, ctx: ReferenceContext, unresolved: string[]): t.Node => {
  // A value with nothing to pull in is returned as it was parsed, so it keeps the story's own
  // formatting rather than being reprinted from a rebuilt tree.
  if (!hasNamedSpread(node)) {
    return node;
  }

  if (t.isArrayExpression(node)) {
    return t.arrayExpression(
      node.elements.map((element) =>
        element && t.isExpression(element)
          ? (inlineSpreads(element, ctx, unresolved) as t.Expression)
          : element
      )
    );
  }

  if (!t.isObjectExpression(node)) {
    return node;
  }
  if (!node.properties.some((property) => t.isSpreadElement(property))) {
    return objectFrom(node.properties, ctx, unresolved) ?? node;
  }

  const members = resolveArgsRecord(node, ctx);
  if (members.unresolved.length > 0) {
    unresolved.push(...members.unresolved);
    return node;
  }
  return (
    objectFrom(
      Object.entries(members.properties).map(([key, value]) =>
        t.objectProperty(
          t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key),
          value as t.Expression
        )
      ),
      ctx,
      unresolved
    ) ?? node
  );
};

/**
 * Whether a value spreads something it names rather than something written out on the spot.
 *
 * Only a named spread is worth writing out: `{ ...{ a: 1 }, b: 2 }` already says what it holds, so
 * rewriting it would reprint the story's own source for no gain.
 */
const hasNamedSpread = (node: t.Node): boolean => {
  if (t.isArrayExpression(node)) {
    return node.elements.some(
      (element) => element !== null && t.isExpression(element) && hasNamedSpread(element)
    );
  }
  return (
    t.isObjectExpression(node) &&
    node.properties.some((property) =>
      t.isSpreadElement(property)
        ? !t.isObjectExpression(unwrapExpression(property.argument))
        : t.isObjectProperty(property) &&
          t.isExpression(property.value) &&
          hasNamedSpread(property.value)
    )
  );
};

/** An object literal with every member value's own spreads written out, when they all can be. */
const objectFrom = (
  properties: t.ObjectExpression['properties'],
  ctx: ReferenceContext,
  unresolved: string[]
): t.ObjectExpression | undefined => {
  const rebuilt: t.ObjectExpression['properties'] = [];
  for (const property of properties) {
    if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
      return undefined;
    }
    const value = inlineSpreads(property.value, ctx, unresolved) as t.Expression;
    // A shorthand prints its key and nothing else, so it may only stay shorthand while its value is
    // still the one the key stands for.
    rebuilt.push(
      t.objectProperty(
        property.key,
        value,
        property.computed,
        property.shorthand && value === property.value
      )
    );
  }
  return t.objectExpression(rebuilt);
};

/** Reads a bare name through to the value it was declared with, as far as the chain goes. */
const followValue = (node: t.Node, ctx: ReferenceContext, seen: Set<string>): t.Node => {
  if (!t.isIdentifier(node) || seen.has(node.name)) {
    return node;
  }
  const binding = ctx.program.scope.getBinding(node.name);
  if (
    !binding ||
    binding.kind === 'module' ||
    !binding.constant ||
    !t.isVariableDeclarator(binding.path.node) ||
    !binding.path.node.init
  ) {
    return node;
  }
  seen.add(node.name);
  return followValue(unwrapExpression(binding.path.node.init), ctx, seen);
};

/**
 * Names an expression reaches for from outside itself. ES globals count as resolved, since they
 * mean the same wherever the snippet lands.
 */
const freeNames = (node: t.Node): Set<string> => {
  const expression = t.isExpression(node)
    ? node
    : t.isObjectMethod(node)
      ? t.objectExpression([node])
      : undefined;
  if (expression === undefined) {
    throw new Error(`Cannot read the names a ${node.type} depends on: it is not an expression`);
  }

  // The clone keeps this traversal from binding scope information to nodes the story file's own
  // program still owns.
  const wrapped = t.file(
    t.program([t.expressionStatement(t.cloneNode(expression, true) as t.Expression)])
  );
  const names = new Set<string>();
  traverse(wrapped, {
    ReferencedIdentifier(path) {
      if (!path.scope.hasBinding(path.node.name)) {
        names.add(path.node.name);
      }
    },
  });
  return names;
};
