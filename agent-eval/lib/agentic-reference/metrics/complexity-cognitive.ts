// Cognitive complexity per function, following Sonar's specification
// (https://www.sonarsource.com/docs/CognitiveComplexity.pdf, Appendix B).
//
// Unlike cyclomatic complexity, it charges no cost of entry for a function,
// so it doesn't penalise LLMs that extract generic utilities.
//
// Deliberately not implemented: recursion detection, which needs name
// resolution the single-file parse does not have. It is rare in the component
// code these evals touch.
//
// Inline anonymous callbacks follow the white paper's lambda rule: they are
// not units of their own — their contents count toward the enclosing
// function, one nesting level deeper. Name-bound functions are still measured
// separately, from depth 0. See function-units.ts for the boundary.
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

export function cognitiveForSource(filename: string, source: string): FunctionComplexity[] {
  if (!SCRIPT_EXTENSIONS.test(filename)) return [];

  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      filename,
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      scriptKindFor(filename)
    );
  } catch {
    return [];
  }

  const results: FunctionComplexity[] = [];

  const measure = (functionNode: ts.Node, name: string): void => {
    let complexity = 0;

    const walk = (node: ts.Node, depth: number): void => {
      // Nested units are measured on their own, from depth 0. An absorbed
      // callback is no unit: per the lambda rule its contents count here,
      // one nesting level deeper.
      if (node !== functionNode && isFunctionLike(node)) {
        if (!isAbsorbedCallback(node)) return;
        ts.forEachChild(node, (child) => walk(child, depth + 1));
        return;
      }

      if (ts.isIfStatement(node)) {
        // An `else if` costs 1 flat; a fresh `if` costs 1 plus its depth.
        const elseIf = isElseIf(node);
        complexity += elseIf ? 1 : 1 + depth;
        const branchDepth = elseIf ? depth : depth + 1;

        walk(node.expression, depth);
        walk(node.thenStatement, branchDepth);

        if (node.elseStatement) {
          if (ts.isIfStatement(node.elseStatement)) {
            // Charged by its own visit as an else-if; keep the same depth.
            walk(node.elseStatement, branchDepth);
          } else {
            complexity += 1; // a plain `else`, no nesting penalty
            walk(node.elseStatement, branchDepth);
          }
        }
        return;
      }

      if (isNestingStructure(node)) {
        complexity += 1 + depth;
        ts.forEachChild(node, (child) => walk(child, depth + 1));
        return;
      }

      if (ts.isBinaryExpression(node) && LOGICAL_OPERATORS.has(node.operatorToken.kind)) {
        if (startsOperatorRun(node)) complexity += 1;
      }

      // A labelled break or continue is a jump out of normal flow: +1 flat.
      if ((ts.isBreakStatement(node) || ts.isContinueStatement(node)) && node.label !== undefined) {
        complexity += 1;
      }

      ts.forEachChild(node, (child) => walk(child, depth));
    };

    walk(functionNode, 0);
    results.push({ name, complexity });
  };

  const visit = (node: ts.Node): void => {
    if (isFunctionLike(node) && !isAbsorbedCallback(node)) {
      measure(node, nameOfFunctionLike(node));
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return results;
}
