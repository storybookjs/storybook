import { type NodePath, types as t } from 'storybook/internal/babel';

import { resolveIdentifierInit } from './utils.ts';

export type NormalizedStoryDeclaration =
  | { type: 'config'; path: NodePath<t.ObjectExpression> }
  | {
      type: 'fn';
      path: NodePath<t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration>;
    }
  | { type: 'emptyConfig'; path: NodePath<t.Expression> };

type StoryDeclarationExpression = NodePath<t.FunctionDeclaration | t.Expression>;

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
  const storyPath = declarationExpression(storyDeclaration);
  const resolvedBindPath = bindInitializer(storyDeclaration, storyPath);
  const normalizedPath = resolvedBindPath ?? factoryArgumentExpression(storyPath);
  const unwrappedPath = unwrapTypeExpression(normalizedPath);

  return classifyStoryPath(unwrappedPath);
}

/** Declaration body that can be classified as a story shape. */
function declarationExpression(storyDeclaration: NodePath<t.Node>): StoryDeclarationExpression {
  if (storyDeclaration.isFunctionDeclaration()) {
    return storyDeclaration;
  }

  if (storyDeclaration.isVariableDeclarator()) {
    const init = storyDeclaration.get('init');
    if (!init.isExpression()) {
      throw storyDeclaration.buildCodeFrameError('Expected story initializer to be an expression');
    }
    return init;
  }

  throw storyDeclaration.buildCodeFrameError(
    'Expected story to be a function or variable declaration'
  );
}

/** Initializer resolved from a local `Template.bind(...)` call. */
function bindInitializer(
  storyDeclaration: NodePath<t.Node>,
  storyPath: StoryDeclarationExpression
): StoryDeclarationExpression | null {
  if (!storyPath.isCallExpression()) {
    return null;
  }

  const callee = storyPath.get('callee');
  if (!callee.isMemberExpression()) {
    return null;
  }

  const obj = callee.get('object');
  const prop = callee.get('property');
  const isBind =
    (prop.isIdentifier() && prop.node.name === 'bind') ||
    (t.isStringLiteral(prop.node) && prop.node.value === 'bind');

  if (!obj.isIdentifier() || !isBind) {
    return null;
  }

  return resolveIdentifierInit(storyDeclaration, obj);
}

/** Single config argument from factory calls, preserving zero-arg calls. */
function factoryArgumentExpression(
  storyPath: StoryDeclarationExpression
): StoryDeclarationExpression {
  if (!storyPath.isCallExpression()) {
    return storyPath;
  }

  const args = storyPath.get('arguments');
  if (args.length === 0) {
    return storyPath;
  }

  if (args.length !== 1 || !args[0].isExpression()) {
    throw storyPath.buildCodeFrameError('Could not evaluate story expression');
  }

  return args[0];
}

/** Expression inside a TypeScript `satisfies` or `as` wrapper. */
function unwrapTypeExpression(storyPath: StoryDeclarationExpression): StoryDeclarationExpression {
  if (storyPath.isTSSatisfiesExpression()) {
    return storyPath.get('expression');
  }

  if (storyPath.isTSAsExpression()) {
    return storyPath.get('expression');
  }

  return storyPath;
}

/** Final story shape classification for a normalized declaration path. */
function classifyStoryPath(storyPath: StoryDeclarationExpression): NormalizedStoryDeclaration {
  if (storyPath.isObjectExpression()) {
    return { type: 'config', path: storyPath };
  }

  if (
    storyPath.isArrowFunctionExpression() ||
    storyPath.isFunctionExpression() ||
    storyPath.isFunctionDeclaration()
  ) {
    return { type: 'fn', path: storyPath };
  }

  if (
    storyPath.isCallExpression() &&
    Array.isArray(storyPath.node.arguments) &&
    storyPath.node.arguments.length === 0
  ) {
    return { type: 'emptyConfig', path: storyPath };
  }

  throw storyPath.buildCodeFrameError(
    'Expected story to be csf factory, function or an object expression'
  );
}
