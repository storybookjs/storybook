import { type E, type Node, codeFrame } from '../estree/ast.ts';
import type { SourceEditor } from '../estree/editor.ts';
import { isCanonicalCsf2BindCall, isCsfFactoryCall, resolveIdentifierInit } from './utils.ts';

export type NormalizedStoryDeclaration =
  | { type: 'config'; node: E.ObjectExpression }
  | { type: 'fn'; node: E.ArrowFunctionExpression | E.Function }
  | { type: 'emptyConfig'; node: E.CallExpression };

type StoryDeclarationExpression = E.Function | E.Expression;

/** An error pointing at the node a story file got wrong. */
export const storyShapeError = (message: string, node: Node, editor: SourceEditor) => {
  const span = node as Node & { start: number; end: number };
  return new SyntaxError(`${message}\n${codeFrame(editor.fileName, editor.code, span.start)}`);
};

/**
 * Resolve a story export's declaration to its snippet-ready story shape.
 *
 * @example
 *
 * ```ts
 * export const A: Story = { args: {} }; //            → { type: 'config', node }
 * export const B = {} satisfies Story; //             → { type: 'config', node }
 * export const C = meta.story({ args: {} }); //       → { type: 'config', node }
 * export const D = meta.story(); //                   → { type: 'emptyConfig', node }
 * export const E = Template.bind({}); //              → Template's classified initializer
 * ```
 */
export function normalizeStoryDeclaration(
  storyDeclaration: Node,
  editor: SourceEditor
): NormalizedStoryDeclaration {
  const storyNode = resolveLocalStory(editor, declarationExpression(storyDeclaration, editor));
  const resolvedBind = bindInitializer(editor, storyNode);
  const normalized = resolvedBind ?? factoryArgumentExpression(storyNode, editor);
  const unwrapped = unwrapTypeExpression(normalized);

  return classifyStory(unwrapped, editor);
}

/** Follows a chain of constant local aliases (`export const A = Impl`) to the story they name. */
function resolveLocalStory(
  editor: SourceEditor,
  expression: StoryDeclarationExpression
): StoryDeclarationExpression {
  const visited = new Set<string>();
  let current = unwrapTypeExpression(expression);

  while (current.type === 'Identifier') {
    const { name } = current;
    if (visited.has(name) || !editor.scopes.program.bindings.get(name)?.constant) {
      break;
    }
    visited.add(name);
    const resolved = resolveIdentifierInit(editor.program, name);
    if (!resolved) {
      break;
    }
    current = unwrapTypeExpression(resolved);
  }

  return current;
}

/** Declaration body that can be classified as a story shape. */
function declarationExpression(
  storyDeclaration: Node,
  editor: SourceEditor
): StoryDeclarationExpression {
  if (storyDeclaration.type === 'FunctionDeclaration') {
    return storyDeclaration;
  }

  if (storyDeclaration.type === 'VariableDeclarator') {
    if (!storyDeclaration.init) {
      throw storyShapeError(
        'Expected story initializer to be an expression',
        storyDeclaration,
        editor
      );
    }
    return storyDeclaration.init;
  }

  throw storyShapeError(
    'Expected story to be a function or variable declaration',
    storyDeclaration,
    editor
  );
}

/** Initializer resolved from a local `Template.bind(...)` call. */
function bindInitializer(
  editor: SourceEditor,
  storyNode: StoryDeclarationExpression
): StoryDeclarationExpression | null {
  if (!isCanonicalCsf2BindCall(storyNode)) {
    return null;
  }
  return resolveIdentifierInit(editor.program, storyNode.callee.object.name);
}

/** Single config argument from factory calls, preserving zero-arg calls. */
function factoryArgumentExpression(
  storyNode: StoryDeclarationExpression,
  editor: SourceEditor
): StoryDeclarationExpression {
  if (!isCsfFactoryCall(storyNode)) {
    return storyNode;
  }

  const args = storyNode.arguments;
  if (args.length === 0) {
    return storyNode;
  }

  if (args.length !== 1 || args[0].type === 'SpreadElement') {
    throw storyShapeError('Could not evaluate story expression', storyNode, editor);
  }

  return args[0];
}

function unwrapTypeExpression(storyNode: StoryDeclarationExpression): StoryDeclarationExpression {
  if (storyNode.type === 'TSSatisfiesExpression' || storyNode.type === 'TSAsExpression') {
    return storyNode.expression;
  }

  return storyNode;
}

function classifyStory(
  storyNode: StoryDeclarationExpression,
  editor: SourceEditor
): NormalizedStoryDeclaration {
  if (storyNode.type === 'ObjectExpression') {
    return { type: 'config', node: storyNode };
  }

  if (
    storyNode.type === 'ArrowFunctionExpression' ||
    storyNode.type === 'FunctionExpression' ||
    storyNode.type === 'FunctionDeclaration'
  ) {
    return { type: 'fn', node: storyNode };
  }

  if (isCsfFactoryCall(storyNode) && storyNode.arguments.length === 0) {
    return { type: 'emptyConfig', node: storyNode };
  }

  throw storyShapeError(
    'Expected story to be csf factory, function or an object expression',
    storyNode,
    editor
  );
}
