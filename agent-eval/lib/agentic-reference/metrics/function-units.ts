// What counts as one measured function, shared by every complexity walker.
//
// The walkers report per-function scores, so they all need the same answer to
// "is this node its own unit, or part of its parent?" — if two metrics
// disagreed, their per-file sums would describe different decompositions of
// the same code.
//
// An inline anonymous callback — a function expression or arrow passed
// directly as a call argument or written directly inside a JSX expression,
// as in `items.map((item) => …)` or `onClick={() => …}` — is NOT a unit: it
// cannot be understood apart from the expression it is written in, it closes
// over the enclosing scope, and Sonar's cognitive-complexity specification
// likewise counts lambda contents toward the enclosing method (as a nesting
// increment) rather than scoring lambdas on their own. Its contents belong to
// the enclosing function, and it charges no cyclomatic base of its own.
//
// Everything bound to a name — function declarations, methods, accessors,
// variable initializers, property values, class fields — is a deliberate unit
// and is measured separately. So is a callback with no enclosing function at
// all (a top-level `describe(…)` block, say): it has nowhere to be absorbed
// into, and dropping it would erase its contents from the metric.
import ts from 'typescript';

export function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/**
 * In a position where the function is passed inline rather than bound to a
 * name: a direct call (or `new`) argument, or the immediate expression of a
 * JSX `{…}` — an attribute value or a rendered child. Anything else (variable
 * initializers, object properties, array elements, IIFE callees) is not
 * "inline" in this sense and stays a unit.
 */
function isInlineCallbackPosition(node: ts.Node): boolean {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return false;
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    return parent.arguments?.some((argument) => argument === node) ?? false;
  }
  return ts.isJsxExpression(parent);
}

function hasEnclosingFunction(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (isFunctionLike(current)) return true;
    current = current.parent;
  }
  return false;
}

/**
 * A function whose contents are measured as part of its enclosing function
 * rather than as a unit of its own.
 */
export function isAbsorbedCallback(node: ts.Node): boolean {
  return isInlineCallbackPosition(node) && hasEnclosingFunction(node);
}
