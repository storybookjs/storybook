import type { types as t } from 'storybook/internal/babel';
import { type NodePath } from 'storybook/internal/babel';

import { keyOf, resolveIdentifierInit } from './utils.ts';

/** A function a story or meta supplies through `render`. */
export type RenderFunctionPath = NodePath<
  t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration
>;

/**
 * Outcome of looking for a `render` function.
 *
 * `missing` and `unresolved` have to stay distinct. A story whose `render` exists but cannot be
 * read must not fall back to the meta's `render`: the story's intent was to override it, and
 * quietly rendering the meta's version instead produces a snippet for code the story never runs.
 */
export type RenderResolution =
  | { kind: 'missing' }
  | { kind: 'resolved'; path: RenderFunctionPath }
  | { kind: 'unresolved' };

const isRenderFunction = (path: NodePath<t.Node>): path is RenderFunctionPath =>
  path.isArrowFunctionExpression() || path.isFunctionExpression() || path.isFunctionDeclaration();

/**
 * Resolves the `render` property of a story or meta config, following a local identifier
 * (`render: Template`) to the function it names.
 *
 * `storyDeclaration` anchors the identifier lookup to the module the story lives in, so a helper
 * declared beside the story resolves while an imported one reports `unresolved`.
 *
 * Throws when `render` is present but is neither a function nor an identifier, because that is a
 * story-file mistake rather than something a static pass merely could not follow.
 */
export function resolveRenderFunction(
  properties: NodePath<t.ObjectProperty>[],
  storyDeclaration: NodePath<t.Node>
): RenderResolution {
  const renderPath = properties.find((property) => keyOf(property.node) === 'render')?.get('value');

  if (!renderPath) {
    return { kind: 'missing' };
  }

  if (renderPath.isIdentifier()) {
    const resolved = resolveIdentifierInit(storyDeclaration, renderPath);
    return resolved && isRenderFunction(resolved)
      ? { kind: 'resolved', path: resolved }
      : { kind: 'unresolved' };
  }

  if (!isRenderFunction(renderPath)) {
    throw renderPath.buildCodeFrameError(
      'Expected render to be an arrow function or function expression'
    );
  }

  return { kind: 'resolved', path: renderPath };
}
