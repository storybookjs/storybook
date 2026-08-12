import type { types as t } from 'storybook/internal/babel';
import { type NodePath } from 'storybook/internal/babel';

import { keyOf, resolveIdentifierInit } from './utils.ts';

/** A function a story or meta supplies through `render`. */
export type RenderFunctionPath = NodePath<
  t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration | t.ObjectMethod
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
 * (`render: Template`) to the function it names and accepting the `render(args) {}` method
 * shorthand.
 *
 * Spread semantics follow the runtime: a spread written after `render` can shadow it, so the
 * result is `unresolved`; a spread before it is harmless because the explicit property wins. When
 * `render` is missing, any spread could still be supplying one, which is also `unresolved`.
 *
 * `storyDeclaration` anchors the identifier lookup to the module the story lives in, so a helper
 * declared beside the story resolves while an imported one reports `unresolved`.
 *
 * Throws when `render` is present but is neither a function nor an identifier, because that is a
 * story-file mistake rather than something a static pass merely could not follow.
 */
export function resolveRenderFunction(
  config: NodePath<t.ObjectExpression> | undefined,
  storyDeclaration: NodePath<t.Node>
): RenderResolution {
  const properties = config?.get('properties') ?? [];
  const renderIndex = properties.findIndex(
    (property) =>
      (property.isObjectProperty() || property.isObjectMethod()) &&
      keyOf(property.node) === 'render'
  );

  if (renderIndex === -1) {
    return properties.some((property) => property.isSpreadElement())
      ? { kind: 'unresolved' }
      : { kind: 'missing' };
  }

  if (properties.some((property, index) => index > renderIndex && property.isSpreadElement())) {
    return { kind: 'unresolved' };
  }

  const renderProperty = properties[renderIndex];
  if (renderProperty.isObjectMethod()) {
    return { kind: 'resolved', path: renderProperty };
  }

  const renderPath = (renderProperty as NodePath<t.ObjectProperty>).get('value');

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
