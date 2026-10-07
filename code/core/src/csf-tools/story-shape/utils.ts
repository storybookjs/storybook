import type { CsfFile } from '../CsfFile.ts';
import { type E, type Node, isFunction, isStringLiteral, unwrapExpression } from '../estree/ast.ts';

export { unwrapExpression };
export {
  csfFactoryReceiver,
  isCanonicalCsf2BindCall,
  isCsfFactoryCall,
  withoutTypeCalls,
} from '../CsfFile.ts';

/** A function a story or meta can supply as `render`, including a method's function expression. */
export type FunctionNode = E.Function | E.ArrowFunctionExpression;

/**
 * Static key of an object member, or `null` when it is computed from something else.
 *
 * A computed key written as a string literal is static: `{ ['args']: … }` names the same member as
 * `{ args: … }`, so it reads as that name rather than as a key only running the story would produce.
 */
export const keyOf = (p: E.ObjectProperty): string | null =>
  isStringLiteral(p.key)
    ? p.key.value
    : !p.computed && p.key.type === 'Identifier'
      ? p.key.name
      : null;

/** Value of an object expression's own property, when it has one. */
export const propertyValue = (
  object: E.ObjectExpression | undefined | null,
  name: string
): Node | undefined =>
  object?.properties.find(
    (candidate): candidate is E.ObjectProperty =>
      candidate.type === 'Property' && !candidate.method && keyOf(candidate) === name
  )?.value;

/**
 * Expression a function returns directly, covering the concise body (`() => …`) and a block body
 * that is only a `return`.
 *
 * A block body must hold nothing but that `return`, since any extra statement could change what the
 * expression evaluates to and a static reader cannot follow it.
 */
export const returnedExpression = (node: Node | null | undefined): E.Expression | undefined => {
  // A method shorthand (`setup() { … }`) returns what its function returns.
  const fn = node?.type === 'Property' && node.method ? node.value : node;
  if (!isFunction(fn) || !fn.body) {
    return undefined;
  }
  if (fn.body.type !== 'BlockStatement') {
    return fn.body as E.Expression;
  }
  const [statement, ...rest] = fn.body.body;
  return rest.length === 0 && statement?.type === 'ReturnStatement' && statement.argument
    ? statement.argument
    : undefined;
};

/**
 * Object literal a render function resolves to, following a local identifier when it returns one.
 *
 * @example `() => ({ template })` and `() => config` with `const config = { template }` both →
 * that object literal
 */
export const resolveReturnedObjectExpression = (
  renderFunction: FunctionNode,
  program: E.Program
): E.ObjectExpression | undefined => {
  const returned = returnedExpression(renderFunction);
  if (returned?.type === 'ObjectExpression') {
    return returned;
  }
  if (returned?.type !== 'Identifier') {
    return undefined;
  }
  const resolved = resolveIdentifierInit(program, returned.name);
  return resolved?.type === 'ObjectExpression' ? resolved : undefined;
};

/** Resolve a local story helper used by `Template.bind({})` or `render: Template`. */
export function resolveIdentifierInit(
  program: E.Program,
  name: string
): E.Function | E.Expression | null {
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type === 'FunctionDeclaration' && declaration.id?.name === name) {
      return declaration;
    }
  }

  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') {
      continue;
    }
    const match = declaration.declarations.find(
      (declarator) => declarator.id.type === 'Identifier' && declarator.id.name === name
    );
    if (match) {
      return match.init ?? null;
    }
  }

  return null;
}

/** Object literal of the parsed CSF default meta, when it is part of the file. */
export function metaObject(csf: CsfFile): E.ObjectExpression | undefined {
  return csf._metaNodeIsSynthetic ? undefined : csf._metaNode;
}
