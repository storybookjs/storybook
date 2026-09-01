// Structural size of the markup in a file: how many tags, how many live
// wires feed them, and how deep the trees run.
//
// These are deliberately not complexity metrics — they carry no opinion about
// branching. Splitting them out keeps jsxCyclomatic a pure path count and
// jsxCognitive a pure reading-flow cost, while still answering "did the agent
// leave bigger, deeper, busier markup behind?" on axes of their own:
//
//   jsxLength      number of JSX elements. Fragments render no node and are
//                  not counted.
//   jsxBindings    dynamic slots the reader must trace: props (spreads
//                  included) plus `{...}` expression children. Static text
//                  children are free — `{item}` is more to reason about than
//                  the word "item".
//   jsxDepthTotal  the deepest nesting level of each tree, summed. Fragments
//   / jsxTrees     count as a level (their indentation is read like any
//                  other), and a tree extends through expressions and inline
//                  callbacks: the `<li>` in `<ul>{items.map((i) => <li/>)}`
//                  sits at depth 2 of the ul tree, not in a tree of its own.
//                  Stored as a numerator/denominator pair so per-file values
//                  stay summable; divide for the average tree depth, which is
//                  the number reported (an eval cares whether trees got
//                  deeper on average, where a whole-project maximum would be
//                  pinned by a single outlier and average-of-averages would
//                  weight a one-tree file like a twenty-tree file).
//
// Attribution is per file, not per function: these are counts over every JSX
// tree in the file, wherever it is written.
import ts from 'typescript';

import { scriptKindFor } from './sloc.ts';

export interface JsxStructure {
  jsxLength: number;
  jsxBindings: number;
  jsxDepthTotal: number;
  jsxTrees: number;
}

const SCRIPT_EXTENSIONS = /\.(?:tsx?|jsx?|mjs|cjs)$/;

const EMPTY: JsxStructure = { jsxLength: 0, jsxBindings: 0, jsxDepthTotal: 0, jsxTrees: 0 };

function isJsxTag(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
}

/** A `{...}` rendered as a child, holding an actual expression — a comment-only container is not a binding. */
function isExpressionChild(node: ts.Node): boolean {
  return (
    ts.isJsxExpression(node) &&
    node.expression !== undefined &&
    node.parent !== undefined &&
    (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
  );
}

export function jsxStructureForSource(filename: string, source: string): JsxStructure {
  if (!SCRIPT_EXTENSIONS.test(filename)) return { ...EMPTY };

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
    return { ...EMPTY };
  }

  const structure: JsxStructure = { ...EMPTY };

  // Returns the deepest markup level found in the subtree (0 when none), so a
  // root can record its tree's depth once the whole tree has been visited.
  const visit = (node: ts.Node, depth: number): number => {
    let level = depth;
    let self = 0;
    const isMarkup = isJsxTag(node) || ts.isJsxFragment(node);

    if (isMarkup) {
      // A markup node at depth 0 starts a tree; anything with a JSX ancestor
      // — through expressions, attributes or inline callbacks — continues one.
      if (depth === 0) structure.jsxTrees += 1;
      level = depth + 1;
      self = level;
      if (isJsxTag(node)) structure.jsxLength += 1;
    }

    if (ts.isJsxAttribute(node) || ts.isJsxSpreadAttribute(node)) structure.jsxBindings += 1;
    if (isExpressionChild(node)) structure.jsxBindings += 1;

    let deepest = self;
    ts.forEachChild(node, (child) => {
      deepest = Math.max(deepest, visit(child, level));
    });

    if (isMarkup && depth === 0) structure.jsxDepthTotal += deepest;
    return deepest;
  };

  visit(sourceFile, 0);
  return structure;
}
