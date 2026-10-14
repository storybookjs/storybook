// Reads the object a call to a story helper returns, as in `{ ...createStory('primary'), args }`.
import { type NodePath, types as t } from 'storybook/internal/babel';

import { isSelfContained } from './resolve-arg-value.ts';
import { unwrapExpression } from './utils.ts';

/** The object a call returns, and the same object with the arguments that name things left out. */
export interface ReturnedObject {
  object: t.ObjectExpression;
  /**
   * `object` with `undefined` for every argument that is not self-contained, so a module the call
   * leaves can be checked for the names it reaches without the caller's own.
   */
  standIn: t.ObjectExpression;
  /** Whether `standIn` left out an argument `object` holds. */
  leftOut: boolean;
}

/**
 * The object literal a call to `fn` returns, with each parameter read as the argument the call
 * passes, or its default.
 *
 * `fn` has to be a plain function whose body is `const` declarations and one `return`, of an object
 * literal or a choice between them that the arguments decide, as in
 * `return compact ? base : { parameters: base }`. Anything else is `undefined`.
 */
export function returnedObject(
  fn: NodePath<t.Function>,
  args: t.CallExpression['arguments']
): ReturnedObject | undefined {
  const { node } = fn;
  if (node.async || node.generator || args.some((arg) => !t.isExpression(arg))) {
    return undefined;
  }
  const returned = t.isExpression(node.body) ? node.body : bodyReturn(node.body);
  if (!returned) {
    return undefined;
  }

  // Each name the function declares stands for a node: a parameter for its argument, a `const` for
  // its initializer.
  const values = new Map<string, t.Node>();
  for (const [index, param] of node.params.entries()) {
    const name = t.isAssignmentPattern(param) ? param.left : param;
    if (!t.isIdentifier(name)) {
      return undefined;
    }
    const passed = args[index];
    const value =
      passed && !t.isIdentifier(passed, { name: 'undefined' })
        ? passed
        : t.isAssignmentPattern(param)
          ? param.right
          : t.identifier('undefined');
    values.set(name.name, value);
  }
  for (const statement of t.isBlockStatement(node.body) ? node.body.body.slice(0, -1) : []) {
    for (const declarator of (statement as t.VariableDeclaration).declarations) {
      values.set((declarator.id as t.Identifier).name, declarator.init!);
    }
  }

  const references = new Map<t.Node, string>();
  for (const name of values.keys()) {
    const binding = fn.scope.getBinding(name);
    if (!binding || binding.scope !== fn.scope || !binding.constant) {
      return undefined;
    }
    for (const reference of binding.referencePaths) {
      references.set(reference.node, name);
    }
  }
  const passedArgs = new Set<t.Node>(args);

  const write = (leaveOut: boolean) => {
    const inProgress = new Set<string>();
    let leftOut = false;
    const valueOf = (name: string): t.Node => {
      const value = values.get(name)!;
      if (passedArgs.has(value)) {
        if (!leaveOut || isSelfContained(value)) {
          return value;
        }
        leftOut = true;
        return t.identifier('undefined');
      }
      // A `const` read inside its own initializer, from a function there, is left as written.
      if (inProgress.has(name)) {
        return t.identifier(name);
      }
      inProgress.add(name);
      const written = rewrite(value);
      inProgress.delete(name);
      return written;
    };
    const rewrite = (current: t.Node): t.Node => {
      const name = references.get(current);
      if (name !== undefined) {
        return valueOf(name);
      }
      if (!holdsReference(current)) {
        return current;
      }
      const copy: Record<string, unknown> = { ...current };
      for (const key of t.VISITOR_KEYS[current.type] ?? []) {
        const child = (current as unknown as Record<string, unknown>)[key];
        copy[key] = Array.isArray(child)
          ? child.map((item) => (item ? rewrite(item) : item))
          : child && rewrite(child as t.Node);
      }
      if (t.isObjectProperty(current) && copy.value !== current.value) {
        copy.shorthand = false;
      }
      return copy as unknown as t.Node;
    };
    const object = choose(returned);
    return object && { object: rewrite(object) as t.ObjectExpression, leftOut };
  };

  const holdsReference = (current: t.Node) =>
    [...references.keys()].some(
      (reference) => reference.start! >= current.start! && reference.end! <= current.end!
    );

  // The object literal an expression evaluates to, following names and the choices the arguments
  // decide; read on the function as written.
  const choose = (expression: t.Node): t.ObjectExpression | undefined => {
    const current = unwrapExpression(expression);
    const name = references.get(current);
    if (name !== undefined) {
      const value = values.get(name)!;
      return passedArgs.has(value) ? undefined : choose(value);
    }
    if (t.isObjectExpression(current)) {
      return current;
    }
    if (t.isConditionalExpression(current)) {
      const test = truthOf(current.test);
      return test === undefined ? undefined : choose(test ? current.consequent : current.alternate);
    }
    if (t.isLogicalExpression(current)) {
      const left = current.operator === '??' ? nullishOf(current.left) : truthOf(current.left);
      if (left === undefined) {
        return undefined;
      }
      const takesLeft = current.operator === '||' ? left : !left;
      return choose(takesLeft ? current.left : current.right);
    }
    return undefined;
  };

  const literalOf = (expression: t.Node): t.Node => {
    const current = unwrapExpression(expression);
    const name = references.get(current);
    return name === undefined ? current : literalOf(values.get(name)!);
  };

  const truthOf = (expression: t.Node): boolean | undefined => {
    const current = literalOf(expression);
    if (t.isUnaryExpression(current, { operator: '!' })) {
      const inner = truthOf(current.argument);
      return inner === undefined ? undefined : !inner;
    }
    if (t.isStringLiteral(current) || t.isNumericLiteral(current) || t.isBooleanLiteral(current)) {
      return Boolean(current.value);
    }
    if (t.isNullLiteral(current) || t.isIdentifier(current, { name: 'undefined' })) {
      return false;
    }
    return t.isObjectExpression(current) || t.isArrayExpression(current) || t.isFunction(current)
      ? true
      : undefined;
  };

  const nullishOf = (expression: t.Node): boolean | undefined => {
    const current = literalOf(expression);
    if (t.isNullLiteral(current) || t.isIdentifier(current, { name: 'undefined' })) {
      return true;
    }
    return truthOf(current) === undefined ? undefined : false;
  };

  const written = write(false);
  const standIn = written && write(true);
  return written && standIn
    ? { object: written.object, standIn: standIn.object, leftOut: standIn.leftOut }
    : undefined;
}

// The expression a block returns after nothing but `const` declarations of plain names.
const bodyReturn = (body: t.BlockStatement): t.Expression | undefined => {
  const statements = body.body;
  const last = statements.at(-1);
  const declarations = statements.slice(0, -1);
  return t.isReturnStatement(last) &&
    t.isExpression(last.argument) &&
    declarations.every(
      (statement) =>
        t.isVariableDeclaration(statement, { kind: 'const' }) &&
        statement.declarations.every(
          (declarator) => t.isIdentifier(declarator.id) && declarator.init
        )
    )
    ? last.argument
    : undefined;
};
