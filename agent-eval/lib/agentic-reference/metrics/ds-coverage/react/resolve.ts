// React declaration analysis: what a local declaration ultimately renders.
//
// - `styled.div` is `div`
// - `styled(X)` is X, including `.attrs`/`.withConfig` chains and generics
// - `styled(X).withComponent(Y)` replaces the target with Y
// - `memo(X)` and `forwardRef(X)` are X
// - `lazy(() => import('./x'))` is x's default export
// - a wrapper that *merely subsets* a DS component counts as that DS
//   component (i.e. forward props to a single DS root, with no hardcoded children)
import ts from 'typescript';

import { boundNames } from '../module-graph.ts';

import type { ModuleFile } from '../module-graph.ts';
import type { DeclarationAnalyzer, IdentityResolver, Resolution } from '../types.ts';

function unresolved(reason: string): Resolution {
  return { category: 'unresolved', reason };
}

/** Strip parentheses, casts, and non-null assertions. */
function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** Whether a binding name (identifier or destructuring pattern) binds `name`. */
function binds(binding: ts.BindingName, name: string): boolean {
  return boundNames(binding).some((bound) => bound.name === name);
}

/** The declarations a statement introduces into the block that contains it. */
function statementDeclarations(node: ts.Node): readonly ts.VariableDeclaration[] | null {
  return ts.isVariableStatement(node) ? node.declarationList.declarations : null;
}

type LoopStatement = ts.ForOfStatement | ts.ForInStatement | ts.ForStatement;

/**
 * The declarations a loop header introduces. They belong to the loop, not to
 * the block containing it, which is why this is separate from `statementDeclarations`.
 */
function loopDeclarations(node: LoopStatement): readonly ts.VariableDeclaration[] | null {
  return node.initializer && ts.isVariableDeclarationList(node.initializer)
    ? node.initializer.declarations
    : null;
}

/**
 * Resolve `name` as the innermost binding visible at `site`. Parameters shadow
 * module scope but have no statically knowable value, so they resolve to
 * `unresolved`; sibling function-scope declarations are analyzed like any other
 * declaration, and a function-scope destructuring resolves through its
 * initializer exactly as a module-scope one does.
 */
export function resolveScopedName(
  file: ModuleFile,
  site: ts.Node,
  name: string,
  resolver: IdentityResolver
): Resolution {
  for (let scope: ts.Node | undefined = site.parent; scope !== undefined; scope = scope.parent) {
    if (ts.isFunctionLike(scope)) {
      const parameters = (scope as ts.SignatureDeclaration).parameters ?? [];
      for (const parameter of parameters) {
        if (binds(parameter.name, name)) {
          return unresolved(`'${name}' is a parameter in ${file.path}`);
        }
      }
    }
    const statements = ts.isBlock(scope) ? scope.statements : null;
    for (const statement of statements ?? []) {
      for (const declaration of statementDeclarations(statement) ?? []) {
        if (ts.isIdentifier(declaration.name)) {
          if (declaration.name.text === name) {
            return resolver.analyzeDeclaration(file, declaration, name);
          }
          continue;
        }
        const bound = boundNames(declaration.name).find((entry) => entry.name === name);
        if (bound === undefined) continue;
        if (bound.path === null) {
          return unresolved(
            `'${name}' is destructured from an unattributable pattern in ${file.path}`
          );
        }
        return resolver.resolveDestructured(file, declaration, bound.path, name);
      }
      if (
        (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
        statement.name?.text === name
      ) {
        return resolver.analyzeDeclaration(file, statement, name);
      }
    }
    if (ts.isForOfStatement(scope) || ts.isForInStatement(scope) || ts.isForStatement(scope)) {
      for (const declaration of loopDeclarations(scope) ?? []) {
        const bound = boundNames(declaration.name).find((entry) => entry.name === name);
        if (bound === undefined) continue;
        // Only `for…of` names the value its binding reads, and only through
        // the elements it iterates — which is why this defers to
        // `resolveDestructured` rather than answering here. A `for…in` key
        // is a property name, and a `for (;;)` counter is whatever the
        // update expression last made it: neither has a value to attribute.
        if (!ts.isForOfStatement(scope) || bound.path === null) {
          return unresolved(`'${name}' is a loop binding in ${file.path}`);
        }
        return resolver.resolveDestructured(file, declaration, bound.path, name);
      }
    }
  }
  return resolver.resolveLocal(file, name);
}

/** Packages whose default export is a styled-component factory. */
const STYLED_MODULES = new Set(['styled-components', '@emotion/styled']);

/**
 * Whether a resolved binding is a styled factory. A DS is welcome to export
 * its own `styled` (the MUI shape), so DS-package exports qualify too.
 */
function isStyledFactory(resolution: Resolution): boolean {
  if (resolution.category !== 'external' && resolution.category !== 'ds') return false;
  if (resolution.name === 'styled') return true;
  return resolution.name === 'default' && STYLED_MODULES.has(resolution.module);
}

function isReactHelper(resolution: Resolution, helper: string): boolean {
  return (
    resolution.category === 'external' &&
    resolution.module === 'react' &&
    resolution.name === helper
  );
}

type StyledTarget =
  | { kind: 'intrinsic'; tag: string }
  | { kind: 'expression'; node: ts.Expression };

/**
 * If `expression` is a styled-component construction, its target: the
 * intrinsic for `styled.div`, the wrapped expression for `styled(X)` — looking
 * through `.attrs(...)`/`.withConfig(...)` chains and both invocation forms
 * (`styled(X)`tpl``  and `styled(X)<Props>(fn)`). `.withComponent(Y)` swaps
 * the target for Y.
 */
function styledTargetOf(
  file: ModuleFile,
  expression: ts.Expression,
  resolver: IdentityResolver
): StyledTarget | null {
  let current: ts.Expression = expression;
  for (;;) {
    if (ts.isTaggedTemplateExpression(current)) {
      current = current.tag;
      continue;
    }

    if (ts.isCallExpression(current)) {
      const callee = unwrapExpression(current.expression);
      if (
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'withComponent' &&
        styledTargetOf(file, callee.expression, resolver) !== null
      ) {
        const replacement = current.arguments[0];
        if (replacement === undefined) return null;
        if (ts.isStringLiteral(replacement)) return { kind: 'intrinsic', tag: replacement.text };
        return { kind: 'expression', node: replacement };
      }
      if (
        ts.isIdentifier(callee) &&
        isStyledFactory(resolveScopedName(file, callee, callee.text, resolver))
      ) {
        const target = current.arguments[0];
        if (target === undefined) return null;
        // `styled('div')` is `styled.div` spelled the other way, and the only
        // spelling available for a tag the property form cannot express
        // (`styled('my-element')`). Both libraries accept it, and Storybook's
        // own components are written this way throughout.
        if (ts.isStringLiteral(target)) return { kind: 'intrinsic', tag: target.text };
        return { kind: 'expression', node: target };
      }
      current = callee;
      continue;
    }

    if (ts.isPropertyAccessExpression(current)) {
      const base = unwrapExpression(current.expression);
      if (
        ts.isIdentifier(base) &&
        isStyledFactory(resolveScopedName(file, base, base.text, resolver))
      ) {
        // `styled.div` — chain methods (`styled.div.attrs`) arrive here too,
        // but then `base` is `styled.div`, not `styled`, and recursion below
        // reaches it.
        return { kind: 'intrinsic', tag: current.name.text };
      }
      current = base;
      continue;
    }
    return null;
  }
}

/** The `X` of `lazy(() => import('./x'))`, or null. */
function lazyImportSpecifier(argument: ts.Expression | undefined): string | null {
  if (argument === undefined) {
    return null;
  }

  const body =
    ts.isArrowFunction(argument) && ts.isExpression(argument.body)
      ? unwrapExpression(argument.body)
      : null;
  if (
    body !== null &&
    ts.isCallExpression(body) &&
    body.expression.kind === ts.SyntaxKind.ImportKeyword &&
    body.arguments[0] !== undefined &&
    ts.isStringLiteral(body.arguments[0])
  ) {
    return body.arguments[0].text;
  }

  return null;
}

/**
 * Every returned value of a function, ignoring returns of nested functions
 * (those are someone else's render). A bare `return;` appears as null.
 */
function returnedExpressions(
  fn: ts.SignatureDeclaration & { body?: ts.Node }
): Array<ts.Expression | null> {
  if (fn.body === undefined) {
    return [];
  }

  if (ts.isExpression(fn.body)) {
    return [unwrapExpression(fn.body as ts.Expression)];
  }

  const returns: Array<ts.Expression | null> = [];
  const walk = (node: ts.Node): void => {
    if (ts.isReturnStatement(node)) {
      returns.push(node.expression ? unwrapExpression(node.expression) : null);
      return;
    }

    if (ts.isFunctionLike(node)) {
      return;
    }

    ts.forEachChild(node, walk);
  };

  ts.forEachChild(fn.body, walk);

  return returns;
}

/** Resolve a JSX tag name. Shared by census and wrapper analysis. */
export function resolveJsxTag(
  file: ModuleFile,
  tag: ts.JsxTagNameExpression,
  resolver: IdentityResolver
): Resolution {
  if (ts.isIdentifier(tag)) {
    // As per JSX, lowercase tags are host elements, the rest is components.
    if (/^[a-z]/.test(tag.text)) {
      return { category: 'host', tag: tag.text };
    }

    return resolveScopedName(file, tag, tag.text, resolver);
  }

  if (ts.isPropertyAccessExpression(tag)) {
    const properties: string[] = [];
    let base: ts.Node = tag;
    while (ts.isPropertyAccessExpression(base)) {
      properties.unshift(base.name.text);
      base = base.expression;
    }
    if (!ts.isIdentifier(base)) {
      return unresolved(`unresolvable tag base '${tag.getText()}'`);
    }

    let resolution = resolveScopedName(file, base, base.text, resolver);
    for (const property of properties) {
      resolution = resolver.memberOf(resolution, property);
    }

    return resolution;
  }
  // `<this.X>` (legacy class idiom) and namespaced tags (`<svg:rect>`, host
  // markup by construction).
  if (tag.kind === ts.SyntaxKind.ThisKeyword) {
    return unresolved('tag on `this`');
  }

  return { category: 'host', tag: tag.getText() };
}

/**
 * The path into the component's own props that an expression reads, or null if
 * it reads anything else: `[]` for the props parameter itself, `['children']`
 * for `props.children` and for a `{ children }` destructuring, renamed or not.
 */
function propPath(fn: ts.SignatureDeclaration, expression: ts.Expression): string[] | null {
  const expr = unwrapExpression(expression);
  const parameter = fn.parameters[0];
  if (parameter === undefined) {
    return null;
  }

  if (ts.isIdentifier(expr)) {
    return boundNames(parameter.name).find((bound) => bound.name === expr.text)?.path ?? null;
  }

  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) {
    const base = propPath(fn, expr.expression);
    return base === null ? null : [...base, expr.name.text];
  }

  return null;
}

/**
 * Whether an element hands its subtree straight through: it renders either
 * nothing of its own, or nothing but the component's own `children` prop.
 */
function forwardsChildren(fn: ts.SignatureDeclaration, element: ts.JsxElement): boolean {
  const children = element.children.filter((child) => {
    // Indentation between tags, and `{/* comment */}`, render nothing.
    if (ts.isJsxText(child)) return !child.containsOnlyTriviaWhiteSpaces;
    return !ts.isJsxExpression(child) || child.expression !== undefined;
  });
  if (children.length === 0) {
    return true;
  }

  if (
    children.length === 1 &&
    children[0] &&
    ts.isJsxExpression(children[0]) &&
    children[0].expression
  ) {
    const path = propPath(fn, children[0].expression);
    return path?.length === 1 && path[0] === 'children';
  }

  return false;
}

/**
 * Resolve a React component. Here we make the decision to treat prop-wrapping
 * local components as DS components, e.g. if the app defines a Button that
 * hardcodes `size="small"` on a DS Button, we still wanna count that as DS.
 * If the local function forwards props *and* its subtree to a single DS
 * component, it's evidence of a DS override and we return `wrapped-ds`: a
 * local identity that also remembers the DS target it collapses to, so
 * usages of the wrapper still feed its own multiplier (see census.ts) while
 * the static census keeps resolving it straight to the DS identity, exactly
 * as a plain `ds` resolution would.
 */
function analyzeFunctionComponent(
  file: ModuleFile,
  fn: ts.SignatureDeclaration & { body?: ts.Node },
  name: string,
  resolver: IdentityResolver
): Resolution {
  const returns = returnedExpressions(fn);
  const root = returns.length === 1 ? returns[0] : undefined;
  if (root != null && (ts.isJsxElement(root) || ts.isJsxSelfClosingElement(root))) {
    const opening = ts.isJsxElement(root) ? root.openingElement : root;
    // Condition 1: we must forward props to the root DS component.
    // Condition 2: no children, or direct children forwarding.
    const forwardsProps = opening.attributes.properties.some(ts.isJsxSpreadAttribute);
    if (forwardsProps && (!ts.isJsxElement(root) || forwardsChildren(fn, root))) {
      const target = resolveJsxTag(file, opening.tagName, resolver);
      // The root tag can itself be a subsetting wrapper (nested wrappers,
      // `SmallDanger` over `Small` over `Button`): follow through to the
      // DS identity at the end of the chain rather than stopping one level
      // short of it.
      if (target.category === 'ds' || target.category === 'wrapped-ds') {
        const ds =
          target.category === 'ds' ? { module: target.module, name: target.name } : target.ds;
        return { category: 'wrapped-ds', module: file.path, name, ds };
      }
    }
  }
  return { category: 'local', module: file.path, name };
}

function analyzeExpression(
  file: ModuleFile,
  expression: ts.Expression,
  name: string,
  resolver: IdentityResolver
): Resolution {
  const expr = unwrapExpression(expression);

  if (ts.isIdentifier(expr)) {
    return resolveScopedName(file, expr, expr.text, resolver);
  }

  // Handle styled() wrappers earlier to avoid duplicate code.
  if (
    ts.isPropertyAccessExpression(expr) ||
    ts.isCallExpression(expr) ||
    ts.isTaggedTemplateExpression(expr)
  ) {
    const styled = styledTargetOf(file, expr, resolver);
    if (styled !== null) {
      return resolveStyledTarget(file, styled, name, resolver);
    }
  }

  if (ts.isPropertyAccessExpression(expr)) {
    if (ts.isIdentifier(expr.name)) {
      return resolver.memberOf(
        analyzeExpression(file, expr.expression, name, resolver),
        expr.name.text
      );
    }

    return unresolved(`unanalyzable member '${expr.getText()}'`);
  }

  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    return analyzeFunctionComponent(file, expr, name, resolver);
  }

  if (ts.isObjectLiteralExpression(expr)) {
    return { category: 'object', file, node: expr };
  }

  if (ts.isCallExpression(expr)) {
    const callee = unwrapExpression(expr.expression);
    const calleeResolution = ts.isIdentifier(callee)
      ? resolveScopedName(file, callee, callee.text, resolver)
      : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
        ? resolver.memberOf(
            resolveScopedName(file, callee.expression, callee.expression.text, resolver),
            callee.name.text
          )
        : null;

    if (calleeResolution !== null) {
      if (
        isReactHelper(calleeResolution, 'memo') ||
        isReactHelper(calleeResolution, 'forwardRef')
      ) {
        const wrapped = expr.arguments[0];
        if (wrapped !== undefined) {
          return analyzeExpression(file, wrapped, name, resolver);
        }

        return unresolved(`${name}: empty memo/forwardRef`);
      }
      if (isReactHelper(calleeResolution, 'lazy')) {
        const specifier = lazyImportSpecifier(expr.arguments[0]);
        if (specifier !== null) {
          return resolver.resolveModule(file, specifier, 'default');
        }

        return unresolved(`${name}: dynamic lazy()`);
      }
      // `createGlobalStyle(...)` builds a style-injecting component from a
      // css template. Unlike an HOC call, there is no hidden target to find,
      // so the call form resolves like the tagged-template form below.
      if (
        calleeResolution.category === 'external' &&
        calleeResolution.name === 'createGlobalStyle'
      ) {
        return calleeResolution;
      }
      // `createContext(...)` yields the context object, not a renderable.
      if (isReactHelper(calleeResolution, 'createContext')) {
        return { category: 'external', module: 'react', name: 'Context' };
      }
    }

    return unresolved(`unrecognized call binding '${name}' in ${file.path}`);
  }

  // A tagged template over a package import (`createGlobalStyle`, a css-in-js
  // `keyframes` cousin, an i18n tag) hides no target component the way an
  // HOC call can, so the result *is* the package's construct.
  if (ts.isTaggedTemplateExpression(expr)) {
    const tag = unwrapExpression(expr.tag);
    const tagResolution = ts.isIdentifier(tag)
      ? resolveScopedName(file, tag, tag.text, resolver)
      : null;

    if (tagResolution?.category === 'ds' || tagResolution?.category === 'external') {
      return tagResolution;
    }

    return unresolved(`unrecognized call binding '${name}' in ${file.path}`);
  }

  if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr) || ts.isJsxFragment(expr)) {
    return unresolved(`JSX value bound to '${name}' used as a tag`);
  }

  if (ts.isConditionalExpression(expr)) {
    return unresolved(`conditional binding '${name}' in ${file.path}`);
  }

  return unresolved(`unanalyzable declaration '${name}' in ${file.path}`);
}

function resolveStyledTarget(
  file: ModuleFile,
  target: StyledTarget,
  name: string,
  resolver: IdentityResolver
): Resolution {
  if (target.kind === 'intrinsic') {
    return { category: 'host', tag: target.tag };
  }

  return analyzeExpression(file, target.node, name, resolver);
}

export const analyzeReactDeclaration: DeclarationAnalyzer = (file, node, name, resolver) => {
  if (ts.isVariableDeclaration(node)) {
    if (node.initializer === undefined) {
      return unresolved(`'${name}' has no initializer`);
    }

    return analyzeExpression(file, node.initializer, name, resolver);
  }

  if (ts.isFunctionDeclaration(node)) {
    return analyzeFunctionComponent(file, node, name, resolver);
  }

  if (ts.isClassDeclaration(node)) {
    // Class components exist but subsetting wrappers written as classes are
    // vanishingly rare; a class is its own component.
    return { category: 'local', module: file.path, name };
  }

  if (ts.isExpression(node)) {
    return analyzeExpression(file, node, name, resolver);
  }

  return unresolved(`unanalyzable declaration '${name}' in ${file.path}`);
};
