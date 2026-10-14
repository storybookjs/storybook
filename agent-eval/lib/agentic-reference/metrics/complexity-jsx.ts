// JSX-aware variants of the cyclomatic and cognitive complexity walkers.
//
// The classic metrics treat markup as data: a conditional render or a list
// render hidden behind a callback boundary never lands anywhere, and a branch
// buried eight tags deep costs the same as one at the top of the function.
// These variants price render *flow*, each in its parent metric's own style —
// markup size lives elsewhere, in jsx-structure.ts (length, bindings, depth):
//
//   jsxCyclomaticForSource — flat counting, like cyclomatic.
//     Conditional renders (`?:`, `&&`, per operator) are decision points the
//     classic core already counts; what this variant adds is the render loop:
//     +1 for `{items.map((item) => <li/>)}`, for any call with an inline
//     markup-producing callback, and for a map/flatMap call inside JSX even
//     when the callback is a named reference (`{items.map(renderRow)}`).
//
//   jsxCognitiveForSource — depth-weighted, like Sonar cognitive.
//     One unified nesting depth: JSX elements and fragments deepen it, so a
//     ternary in deep markup costs more than one at the top. Structural
//     elements — those with markup children — cost 1 + depth, pricing deep
//     trees superlinearly exactly as nested ifs; leaf elements are free
//     (width is jsx-structure's business). Render loops cost 1 + depth like
//     any loop, with the absorbed callback supplying the deeper level for its
//     contents. Logical operator runs stay flat wherever they appear — child
//     position, prop value, or plain code — per the Sonar rule; ternaries
//     carry depth everywhere for the same reason.
//
// Inline anonymous callbacks are absorbed into the enclosing function exactly
// as in the classic walkers (function-units.ts), so `{items.map((item) =>
// <li/>)}` yields one entry for the component, not a stray `<anonymous>`.
//
// Both variants are strict supersets of their classic counterparts: on source
// containing no JSX they produce identical scores, which complexity-jsx.test.ts
// holds them to against the classic implementations.
//
// Function naming follows complexity-cognitive.ts for both variants, so the
// only place the two naming schemes ever differed — a class-field arrow, which
// the cyclomatic walker names `Class.field` and the cognitive walker
// `<anonymous>` — resolves to the cognitive spelling here. Nothing downstream
// reads the names; only the summed scores are stored.
import ts from 'typescript';

import { isAbsorbedCallback, isFunctionLike } from './function-units.ts';
import { scriptKindFor } from './sloc.ts';
import type { FunctionComplexity } from '../types.ts';

const SCRIPT_EXTENSIONS = /\.(?:tsx?|jsx?|mjs|cjs)$/;

function enclosingClassName(node: ts.Node): string | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
      return current.name?.text ?? 'Anon';
    }
    current = current.parent;
  }
  return undefined;
}

function nameOfFunctionLike(node: ts.Node): string {
  const withClass = (raw: string): string => {
    const className = enclosingClassName(node);
    return className ? `${className}.${raw}` : raw;
  };

  if (ts.isFunctionDeclaration(node)) return node.name?.text ?? '<anonymous>';
  if (ts.isConstructorDeclaration(node)) return withClass('constructor');
  if (
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  ) {
    const name = node.name;
    return withClass(
      name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : 'member'
    );
  }
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (
    parent &&
    ts.isPropertyAssignment(parent) &&
    (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))
  ) {
    return parent.name.text;
  }
  return '<anonymous>';
}

/** A rendered tag. Fragments are excluded: `<>...</>` renders no node of its own. */
function isJsxTag(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
}

/**
 * Whether an element hosts further markup: at least one element or fragment
 * among its direct children. An element holding only text or `{...}`
 * expressions is a leaf — when such an expression branches or loops, that is
 * charged (at this element's depth), so charging the element too would price
 * the same structure twice.
 */
function hasMarkupChildren(node: ts.JsxElement): boolean {
  return node.children.some((child) => isJsxTag(child) || ts.isJsxFragment(child));
}

/**
 * Whether a function builds markup in its own body — not through nested
 * functions, whose markup is their own.
 */
function containsOwnJsx(callback: ts.ArrowFunction | ts.FunctionExpression): boolean {
  const scan = (node: ts.Node): true | undefined => {
    if (isJsxTag(node) || ts.isJsxFragment(node)) return true;
    if (isFunctionLike(node)) return undefined;
    return ts.forEachChild(node, scan);
  };
  return ts.forEachChild(callback, scan) === true;
}

/**
 * Iteration methods worth a loop charge even when the callback is a named
 * reference, so `{items.map(renderRow)}` counts. A name list is a heuristic,
 * but the alternative is a blind spot on the most common list-render idiom;
 * matched only inside JSX so data-shaping maps in plain code stay uncharged
 * (and JSX-free source keeps scoring exactly like the classic metrics).
 */
const RENDER_LOOP_CALLEES = new Set(['map', 'flatMap']);

function calleeName(node: ts.CallExpression): string | undefined {
  const callee = node.expression;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  if (ts.isIdentifier(callee)) return callee.text;
  return undefined;
}

/**
 * A call that renders a collection — the markup analog of a `for` loop, which
 * the classic metrics price at zero because the callback boundary hides it.
 * Either the call carries an inline callback that builds markup (anywhere:
 * `return items.map((item) => <li/>)` in a list component counts), or it is a
 * map-like call written inside JSX, callback named or not.
 */
function isRenderLoop(node: ts.Node, insideJsx: boolean): boolean {
  if (!ts.isCallExpression(node)) return false;
  const hasInlineMarkupCallback = node.arguments.some(
    (argument) =>
      (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) &&
      containsOwnJsx(argument)
  );
  if (hasInlineMarkupCallback) return true;
  return insideJsx && RENDER_LOOP_CALLEES.has(calleeName(node) ?? '');
}

const LOGICAL_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

/**
 * A run of like operators costs 1, not 1 per operator: `a && b && c` reads as
 * one condition. The AST nests as `(a && b) && c`, so only the outermost node
 * of a run — one whose parent is not the same operator — is charged.
 */
function startsOperatorRun(node: ts.BinaryExpression): boolean {
  const parent = node.parent;
  return !(
    parent &&
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === node.operatorToken.kind
  );
}

/** An `if` that is the `else` branch of another `if` — a flat chain, not nesting. */
function isElseIf(node: ts.IfStatement): boolean {
  const parent = node.parent;
  return Boolean(parent && ts.isIfStatement(parent) && parent.elseStatement === node);
}

/** Structures that cost 1 plus the current nesting depth, and deepen it. */
function isNestingStructure(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isCatchClause(node) ||
    ts.isConditionalExpression(node)
  );
}

const DECISION_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CatchClause,
]);

function parse(filename: string, source: string): ts.SourceFile | null {
  if (!SCRIPT_EXTENSIONS.test(filename)) return null;
  try {
    return ts.createSourceFile(
      filename,
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      scriptKindFor(filename)
    );
  } catch {
    return null;
  }
}

/** Per-function results for every measured unit in a source file. */
function measureFunctions(
  sourceFile: ts.SourceFile,
  measure: (functionNode: ts.Node) => number
): FunctionComplexity[] {
  const results: FunctionComplexity[] = [];
  const visit = (node: ts.Node): void => {
    if (isFunctionLike(node) && !isAbsorbedCallback(node)) {
      results.push({ name: nameOfFunctionLike(node), complexity: measure(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return results;
}

export function jsxCyclomaticForSource(filename: string, source: string): FunctionComplexity[] {
  const sourceFile = parse(filename, source);
  if (sourceFile === null) return [];

  return measureFunctions(sourceFile, (functionNode) => {
    let complexity = 1;

    const walk = (node: ts.Node, insideJsx: boolean): void => {
      if (DECISION_KINDS.has(node.kind)) {
        complexity += 1;
      } else if (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind)) {
        complexity += 1;
      }

      if (isRenderLoop(node, insideJsx)) complexity += 1;

      // Stop at nested units: each is measured separately. An absorbed
      // callback is not a unit — its decisions are this function's.
      if (node !== functionNode && isFunctionLike(node) && !isAbsorbedCallback(node)) return;
      const next = insideJsx || isJsxTag(node) || ts.isJsxFragment(node);
      ts.forEachChild(node, (child) => walk(child, next));
    };

    walk(functionNode, false);
    return complexity;
  });
}

export function jsxCognitiveForSource(filename: string, source: string): FunctionComplexity[] {
  const sourceFile = parse(filename, source);
  if (sourceFile === null) return [];

  return measureFunctions(sourceFile, (functionNode) => {
    let complexity = 0;

    const walk = (node: ts.Node, depth: number, insideJsx: boolean): void => {
      // Nested units are measured on their own, from depth 0. An absorbed
      // callback is no unit: per the lambda rule its contents count here, one
      // nesting level deeper — which is also what lets a render loop's charge
      // sit at the call while the looped markup sits one level in.
      if (node !== functionNode && isFunctionLike(node)) {
        if (!isAbsorbedCallback(node)) return;
        ts.forEachChild(node, (child) => walk(child, depth + 1, insideJsx));
        return;
      }

      if (ts.isIfStatement(node)) {
        // An `else if` costs 1 flat; a fresh `if` costs 1 plus its depth.
        const elseIf = isElseIf(node);
        complexity += elseIf ? 1 : 1 + depth;
        const branchDepth = elseIf ? depth : depth + 1;

        walk(node.expression, depth, insideJsx);
        walk(node.thenStatement, branchDepth, insideJsx);

        if (node.elseStatement) {
          if (ts.isIfStatement(node.elseStatement)) {
            // Charged by its own visit as an else-if; keep the same depth.
            walk(node.elseStatement, branchDepth, insideJsx);
          } else {
            complexity += 1; // a plain `else`, no nesting penalty
            walk(node.elseStatement, branchDepth, insideJsx);
          }
        }
        return;
      }

      if (isNestingStructure(node)) {
        complexity += 1 + depth;
        ts.forEachChild(node, (child) => walk(child, depth + 1, insideJsx));
        return;
      }

      // Markup deepens nesting for everything it wraps — children and
      // attributes alike — and structural elements are charged like nested
      // blocks. Leaf elements deepen without charging: what their expressions
      // cost is priced where those expressions branch or loop. Fragments
      // deepen too (the reader's eye pays the level) but render no node, so
      // they never charge.
      if (isJsxTag(node) || ts.isJsxFragment(node)) {
        if (ts.isJsxElement(node) && hasMarkupChildren(node)) complexity += 1 + depth;
        ts.forEachChild(node, (child) => walk(child, depth + 1, true));
        return;
      }

      // The markup analog of a loop, charged like one. It does not deepen
      // here: the absorbed callback provides the deeper level for the looped
      // markup, so charging depth twice would price one construct as two.
      if (isRenderLoop(node, insideJsx)) complexity += 1 + depth;

      // Flat wherever it appears — child position, prop value or plain code —
      // per the Sonar rule: operators count by run, never by nesting.
      if (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind)) {
        if (startsOperatorRun(node)) complexity += 1;
      }

      // A labelled break or continue is a jump out of normal flow: +1 flat.
      if ((ts.isBreakStatement(node) || ts.isContinueStatement(node)) && node.label !== undefined) {
        complexity += 1;
      }

      ts.forEachChild(node, (child) => walk(child, depth, insideJsx));
    };

    walk(functionNode, 0, false);
    return complexity;
  });
}
