import { type NodePath, types as t } from 'storybook/internal/babel';

import { resolveIdentifierInit } from './utils.ts';

/**
 * Resolve a story export's declaration to the expression that carries its config.
 *
 * @example
 *
 * ```ts
 * export const A: Story = { args: {} }; //            → the object expression
 * export const B = {} satisfies Story; //             → the object expression
 * export const C = meta.story({ args: {} }); //       → the object expression
 * export const D = meta.story(); //                   → the call expression (empty config)
 * export const E = Template.bind({}); //              → Template's initializer
 * ```
 */
export function normalizeStoryDeclaration(
  storyDeclaration: NodePath<t.Node>
): NodePath<t.FunctionDeclaration | t.Expression> {
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

  return normalizedPath.isTSSatisfiesExpression()
    ? normalizedPath.get('expression')
    : normalizedPath.isTSAsExpression()
      ? normalizedPath.get('expression')
      : normalizedPath;
}
