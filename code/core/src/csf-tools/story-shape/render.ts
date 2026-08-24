import { type NodePath, type types as t } from 'storybook/internal/babel';

import {
  type ReferenceContext,
  type ResolvedMembers,
  resolveObjectMembers,
} from './resolve-members.ts';
import { keyOf, pathForNode, resolveIdentifierInit } from './utils.ts';

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
 *
 * `shadowedRender` is present when an explicit render resolved but a later spread may replace it
 * at runtime. Strict consumers ignore it and emit nothing; coverage-oriented consumers may prefer
 * it as the best static guess, since spreads rarely carry a render.
 */
export type RenderResolution =
  | { kind: 'missing' }
  | { kind: 'resolved'; path: RenderFunctionPath }
  | { kind: 'unresolved'; shadowedRender?: RenderFunctionPath };

const isRenderFunction = (path: NodePath<t.Node>): path is RenderFunctionPath =>
  path.isArrowFunctionExpression() || path.isFunctionExpression() || path.isFunctionDeclaration();

/**
 * Resolves the `render` property of a story or meta config, following a local identifier
 * (`render: Template`) to the function it names and accepting the `render(args) {}` method
 * shorthand.
 *
 * Spread semantics follow the runtime: a spread written after `render` can shadow it, so the
 * result is `unresolved` (carrying the shadowed function); a spread before it is harmless because
 * the explicit property wins. When `render` is missing, any spread could still be supplying one,
 * which is also `unresolved`.
 *
 * `storyDeclaration` anchors the identifier lookup to the module the story lives in, so a helper
 * declared beside the story resolves while an imported one reports `unresolved`.
 *
 * `references` lets a spread be read rather than assumed: with it, `{ ...Base }` reports whichever
 * `render` `Base` supplies, or `missing` when it supplies none, instead of the `unresolved` a pass
 * that cannot see through the spread has to report.
 *
 * Throws when `render` is present but is neither a function nor an identifier, because that is a
 * story-file mistake rather than something a static pass merely could not follow.
 */
export function resolveRenderFunction(
  config: NodePath<t.ObjectExpression> | undefined,
  storyDeclaration: NodePath<t.Node>,
  references?: ReferenceContext
): RenderResolution {
  const properties = config?.get('properties') ?? [];

  // Duplicate keys resolve to the LAST occurrence, matching runtime object semantics.
  let renderIndex = -1;
  for (let index = properties.length - 1; index >= 0; index -= 1) {
    const property = properties[index];
    if (
      (property.isObjectProperty() || property.isObjectMethod()) &&
      keyOf(property.node) === 'render'
    ) {
      renderIndex = index;
      break;
    }
  }

  const throughSpreads = () =>
    config && references
      ? renderFromMembers(
          resolveObjectMembers(config.node, references),
          references,
          storyDeclaration
        )
      : { kind: 'unresolved' as const };

  if (renderIndex === -1) {
    return properties.some((property) => property.isSpreadElement())
      ? throughSpreads()
      : { kind: 'missing' };
  }

  const resolved = resolveRenderProperty(properties[renderIndex], storyDeclaration);
  if (properties.some((property, index) => index > renderIndex && property.isSpreadElement())) {
    const read = throughSpreads();
    if (read.kind !== 'unresolved') {
      return read;
    }
    return resolved.kind === 'resolved'
      ? { kind: 'unresolved', shadowedRender: resolved.path }
      : { kind: 'unresolved' };
  }

  return resolved;
}

/**
 * The `render` a config's resolved members hold, once its spreads have been followed.
 *
 * A member the story file itself does not contain is `unresolved`: a function another module
 * declares reads as a name that means nothing in a snippet, whichever way it is printed.
 */
function renderFromMembers(
  members: ResolvedMembers,
  references: ReferenceContext,
  storyDeclaration: NodePath<t.Node>
): RenderResolution {
  if (members.unresolved.length > 0) {
    return { kind: 'unresolved' };
  }

  const node = members.properties.render;
  if (node === undefined) {
    return { kind: 'missing' };
  }

  const path = pathForNode(references.program, node);
  if (!path) {
    return { kind: 'unresolved' };
  }
  if (path.isObjectMethod()) {
    return path.node.kind === 'method' && !path.node.generator
      ? { kind: 'resolved', path }
      : { kind: 'unresolved' };
  }
  if (path.isIdentifier()) {
    const resolved = resolveIdentifierInit(storyDeclaration, path);
    return resolved && isRenderFunction(resolved)
      ? { kind: 'resolved', path: resolved }
      : { kind: 'unresolved' };
  }
  return isRenderFunction(path) ? { kind: 'resolved', path } : { kind: 'unresolved' };
}

function resolveRenderProperty(
  renderProperty: NodePath<t.ObjectExpression['properties'][number]>,
  storyDeclaration: NodePath<t.Node>
): Extract<RenderResolution, { kind: 'resolved' | 'unresolved' }> {
  if (renderProperty.isObjectMethod()) {
    // A getter's render value is what it returns, a setter reads as undefined, and a generator is
    // not a render function, so only a plain method is the function itself.
    return renderProperty.node.kind === 'method' && !renderProperty.node.generator
      ? { kind: 'resolved', path: renderProperty }
      : { kind: 'unresolved' };
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
