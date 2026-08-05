import { type NodePath, types as t } from 'storybook/internal/babel';

import { resolveIdentifierInit } from './utils.ts';

export type NormalizedStoryDeclaration =
  | { type: 'config'; path: NodePath<t.ObjectExpression> }
  | {
      type: 'fn';
      path: NodePath<t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration>;
    }
  | { type: 'emptyConfig'; path: NodePath<t.Expression> };

/**
 * Resolve a story export's declaration to its snippet-ready story shape.
 *
 * @example
 *
 * ```ts
 * export const A: Story = { args: {} }; //            → { type: 'config', path }
 * export const B = {} satisfies Story; //             → { type: 'config', path }
 * export const C = meta.story({ args: {} }); //       → { type: 'config', path }
 * export const D = meta.story(); //                   → { type: 'emptyConfig', path }
 * export const E = Template.bind({}); //              → Template's classified initializer
 * ```
 */
export function normalizeStoryDeclaration(
  storyDeclaration: NodePath<t.Node>
): NormalizedStoryDeclaration {
  let storyPath: NodePath<t.FunctionDeclaration | t.Expression>;
  if (storyDeclaration.isFunctionDeclaration()) {
    storyPath = storyDeclaration;
  } else if (storyDeclaration.isVariableDeclarator()) {
    const init = storyDeclaration.get('init');
    if (!init.isExpression()) {
      throw new Error(
        storyDeclaration.buildCodeFrameError('Expected story initializer to be an expression')
          .message
      );
    }
    storyPath = init;
  } else {
    throw storyDeclaration.buildCodeFrameError(
      'Expected story to be a function or variable declaration'
    );
  }

  let normalizedPath: NodePath<t.FunctionDeclaration | t.Expression> = storyPath;

  if (storyPath.isCallExpression()) {
    const callee = storyPath.get('callee');
    if (callee.isMemberExpression()) {
      const obj = callee.get('object');
      const prop = callee.get('property');
      const isBind =
        (prop.isIdentifier() && prop.node.name === 'bind') ||
        (t.isStringLiteral(prop.node) && prop.node.value === 'bind');

      if (obj.isIdentifier() && isBind) {
        const resolved = resolveIdentifierInit(storyDeclaration, obj);

        if (resolved) {
          normalizedPath = resolved;
        }
      }
    }

    if (storyPath === normalizedPath) {
      const args = storyPath.get('arguments');
      if (args.length !== 0) {
        if (args.length !== 1) {
          throw new Error(
            storyPath.buildCodeFrameError('Could not evaluate story expression').message
          );
        }
        const storyArg = args[0];
        if (!storyArg.isExpression()) {
          throw new Error(
            storyPath.buildCodeFrameError('Could not evaluate story expression').message
          );
        }
        normalizedPath = storyArg;
      }
    }
  }

  const unwrappedPath = normalizedPath.isTSSatisfiesExpression()
    ? normalizedPath.get('expression')
    : normalizedPath.isTSAsExpression()
      ? normalizedPath.get('expression')
      : normalizedPath;

  if (unwrappedPath.isObjectExpression()) {
    return { type: 'config', path: unwrappedPath };
  }

  if (
    unwrappedPath.isArrowFunctionExpression() ||
    unwrappedPath.isFunctionExpression() ||
    unwrappedPath.isFunctionDeclaration()
  ) {
    return { type: 'fn', path: unwrappedPath };
  }

  if (
    unwrappedPath.isCallExpression() &&
    Array.isArray(unwrappedPath.node.arguments) &&
    unwrappedPath.node.arguments.length === 0
  ) {
    return { type: 'emptyConfig', path: unwrappedPath };
  }

  throw unwrappedPath.buildCodeFrameError(
    'Expected story to be csf factory, function or an object expression'
  );
}
