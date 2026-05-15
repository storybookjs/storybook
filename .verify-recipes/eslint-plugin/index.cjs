'use strict';

/**
 * ESLint plugin for Storybook verify-recipe structural correctness rules.
 *
 * These rules replace the regex-based structural checks in
 * scripts/verify/recipe-author-core.ts (checkListenerBeforeGoto,
 * checkAttachPattern) with proper AST-level enforcement.
 */

/**
 * Collect all CallExpression nodes that match page.goto(...)
 * or equivalent awaited call in a function body.
 */
function isPageGotoCall(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'page' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'goto'
  );
}

/**
 * Returns true if `node` is a call that registers a listener before goto:
 *   page.on(...)
 *   page.context().on(...)
 *   page.addListener(...)
 */
function isListenerCall(node) {
  if (node.type !== 'CallExpression') return false;
  const { callee } = node;
  if (callee.type !== 'MemberExpression') return false;
  const methodName =
    callee.property.type === 'Identifier' ? callee.property.name : null;

  if (methodName === 'on' || methodName === 'addListener') {
    // page.on(...) or page.addListener(...)
    if (
      callee.object.type === 'Identifier' &&
      callee.object.name === 'page'
    ) {
      return true;
    }
    // page.context().on(...)
    if (
      callee.object.type === 'CallExpression' &&
      callee.object.callee.type === 'MemberExpression' &&
      callee.object.callee.object.type === 'Identifier' &&
      callee.object.callee.object.name === 'page' &&
      callee.object.callee.property.type === 'Identifier' &&
      callee.object.callee.property.name === 'context'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Walk up the AST from a node to find the nearest enclosing function body.
 * Returns the array of statements (BlockStatement body) or null.
 */
function getEnclosingFunctionBody(node, ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (
      ancestor.type === 'FunctionDeclaration' ||
      ancestor.type === 'FunctionExpression' ||
      ancestor.type === 'ArrowFunctionExpression'
    ) {
      if (ancestor.body && ancestor.body.type === 'BlockStatement') {
        return ancestor.body.body;
      }
      return null;
    }
  }
  return null;
}

/**
 * Flatten all ExpressionStatement / AwaitExpression / ExpressionStatement
 * CallExpression nodes from a statement list that appear before a given
 * statement index (shallow, not recursive into nested blocks).
 */
function collectCallsBefore(stmts, beforeIndex) {
  const calls = [];
  for (let i = 0; i < beforeIndex; i++) {
    const stmt = stmts[i];
    extractCalls(stmt, calls);
  }
  return calls;
}

function extractCalls(node, out) {
  if (!node) return;
  if (node.type === 'ExpressionStatement') {
    extractCalls(node.expression, out);
  } else if (node.type === 'AwaitExpression') {
    extractCalls(node.argument, out);
  } else if (node.type === 'CallExpression') {
    out.push(node);
    // also recurse into arguments in case of chained calls
    for (const arg of node.arguments) {
      extractCalls(arg, out);
    }
  } else if (node.type === 'VariableDeclaration') {
    for (const decl of node.declarations) {
      if (decl.init) extractCalls(decl.init, out);
    }
  }
}

/**
 * Returns true if the given node (or any of its ancestors up to the
 * enclosing function) is inside a try...finally block.
 */
function isInsideTryFinally(node, ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (
      ancestor.type === 'TryStatement' &&
      ancestor.finalizer !== null &&
      ancestor.finalizer !== undefined
    ) {
      return true;
    }
    // Stop at function boundaries
    if (
      ancestor.type === 'FunctionDeclaration' ||
      ancestor.type === 'FunctionExpression' ||
      ancestor.type === 'ArrowFunctionExpression'
    ) {
      break;
    }
  }
  return false;
}

module.exports = {
  rules: {
    /**
     * listener-before-goto
     *
     * Ensures that at least one of page.on(...), page.context().on(...),
     * or page.addListener(...) is called before any await page.goto(...) in
     * the same function body. This guarantees console/request listeners are
     * registered before navigation begins.
     */
    'listener-before-goto': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Require a page listener (page.on / page.addListener) to be registered before page.goto() in the same function body.',
        },
        schema: [],
        messages: {
          missingListener:
            'page.goto() called without a prior page.on() / page.addListener() listener in the same function body. Register a listener before navigating.',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (!isPageGotoCall(node)) return;

            const ancestors = context.getAncestors();
            const body = getEnclosingFunctionBody(node, ancestors);
            if (!body) return;

            // Find the index of the statement containing this goto call
            let gotoStmtIndex = -1;
            for (let i = 0; i < body.length; i++) {
              if (containsNode(body[i], node)) {
                gotoStmtIndex = i;
                break;
              }
            }
            if (gotoStmtIndex === -1) return;

            const callsBefore = collectCallsBefore(body, gotoStmtIndex);
            const hasListener = callsBefore.some(isListenerCall);

            if (!hasListener) {
              context.report({
                node,
                messageId: 'missingListener',
              });
            }
          },
        };
      },
    },

    /**
     * attach-pattern
     *
     * Ensures that any call to expect.attach(...) or testInfo.attach(...)
     * appears inside a try { ... } finally { ... } block, so attachments
     * are always made even when the test assertion fails.
     */
    'attach-pattern': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'expect.attach() and testInfo.attach() must be inside a try...finally block to guarantee the attachment is always made.',
        },
        schema: [],
        messages: {
          attachOutsideFinally:
            '{{callee}}.attach() must be inside a try { ... } finally { ... } block.',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (!isAttachCall(node)) return;

            const ancestors = context.getAncestors();
            if (!isInsideTryFinally(node, ancestors)) {
              const calleeName = getAttachCallee(node);
              context.report({
                node,
                messageId: 'attachOutsideFinally',
                data: { callee: calleeName },
              });
            }
          },
        };
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAttachCall(node) {
  if (node.type !== 'CallExpression') return false;
  const { callee } = node;
  if (callee.type !== 'MemberExpression') return false;
  if (
    callee.property.type !== 'Identifier' ||
    callee.property.name !== 'attach'
  ) {
    return false;
  }
  const obj = callee.object;
  // expect.attach(...)
  if (obj.type === 'Identifier' && (obj.name === 'expect' || obj.name === 'testInfo')) {
    return true;
  }
  return false;
}

function getAttachCallee(node) {
  const obj = node.callee.object;
  return obj.type === 'Identifier' ? obj.name : 'unknown';
}

/**
 * Returns true if the subtree rooted at `root` contains `target` (by
 * reference identity). Shallow walk — only descends into statement-level
 * nodes relevant for recipe specs.
 */
function containsNode(root, target) {
  if (root === target) return true;
  if (!root || typeof root !== 'object') return false;
  for (const key of Object.keys(root)) {
    if (key === 'parent') continue; // avoid circular
    const val = root[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (containsNode(item, target)) return true;
      }
    } else if (val && typeof val === 'object' && typeof val.type === 'string') {
      if (containsNode(val, target)) return true;
    }
  }
  return false;
}
