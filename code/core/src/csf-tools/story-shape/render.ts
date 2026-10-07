import type { E, Node } from '../estree/ast.ts';
import type { SourceEditor } from '../estree/editor.ts';
import { storyShapeError } from './normalize-story.ts';
import {
  type ReferenceContext,
  type ResolvedMembers,
  resolveObjectMembers,
} from './resolve-members.ts';
import { type FunctionNode, keyOf, resolveIdentifierInit } from './utils.ts';

/** A function a story or meta supplies through `render`; a method shorthand is its function. */
export type RenderFunction = FunctionNode;

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
  | { kind: 'resolved'; node: RenderFunction }
  | { kind: 'unresolved'; shadowedRender?: RenderFunction };

const isRenderFunction = (node: Node | null | undefined): node is RenderFunction =>
  node?.type === 'ArrowFunctionExpression' ||
  node?.type === 'FunctionExpression' ||
  node?.type === 'FunctionDeclaration';

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
 * `editor` is the module the story lives in, so a helper declared beside the story resolves while
 * an imported one reports `unresolved`.
 *
 * `references` lets a spread be read rather than assumed: with it, `{ ...Base }` reports whichever
 * `render` `Base` supplies, or `missing` when it supplies none, instead of the `unresolved` a pass
 * that cannot see through the spread has to report.
 *
 * Throws when `render` is present but is neither a function nor an identifier, because that is a
 * story-file mistake rather than something a static pass merely could not follow.
 */
export function resolveRenderFunction(
  config: E.ObjectExpression | undefined,
  editor: SourceEditor,
  references?: ReferenceContext
): RenderResolution {
  const properties = config?.properties ?? [];

  // Duplicate keys resolve to the LAST occurrence, matching runtime object semantics.
  let renderIndex = -1;
  for (let index = properties.length - 1; index >= 0; index -= 1) {
    const property = properties[index];
    if (property.type === 'Property' && keyOf(property) === 'render') {
      renderIndex = index;
      break;
    }
  }

  const throughSpreads = () =>
    config && references
      ? renderFromMembers(resolveObjectMembers(config, references), editor)
      : { kind: 'unresolved' as const };

  if (renderIndex === -1) {
    return properties.some((property) => property.type === 'SpreadElement')
      ? throughSpreads()
      : { kind: 'missing' };
  }

  const resolved = resolveRenderProperty(properties[renderIndex] as E.ObjectProperty, editor);
  if (
    properties.some((property, index) => index > renderIndex && property.type === 'SpreadElement')
  ) {
    const read = throughSpreads();
    if (read.kind !== 'unresolved') {
      return read;
    }
    return resolved.kind === 'resolved'
      ? { kind: 'unresolved', shadowedRender: resolved.node }
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
function renderFromMembers(members: ResolvedMembers, editor: SourceEditor): RenderResolution {
  if (members.unresolved.length > 0) {
    return { kind: 'unresolved' };
  }

  const node = members.properties.render;
  if (node === undefined) {
    return { kind: 'missing' };
  }

  if (editor.parentOf(node) === null) {
    return { kind: 'unresolved' };
  }
  if (node.type === 'Property') {
    return methodRender(node as E.ObjectProperty);
  }
  if (node.type === 'Identifier') {
    const resolved = resolveIdentifierInit(editor.program, node.name);
    return isRenderFunction(resolved)
      ? { kind: 'resolved', node: resolved }
      : { kind: 'unresolved' };
  }
  return isRenderFunction(node) ? { kind: 'resolved', node } : { kind: 'unresolved' };
}

// A getter's render value is what it returns, a setter reads as undefined, and a generator is not
// a render function, so only a plain method is the function itself.
const methodRender = (
  property: E.ObjectProperty
): Extract<RenderResolution, { kind: 'resolved' | 'unresolved' }> => {
  const fn = property.value as E.Function;
  return property.kind === 'init' && property.method && !fn.generator
    ? { kind: 'resolved', node: fn }
    : { kind: 'unresolved' };
};

function resolveRenderProperty(
  renderProperty: E.ObjectProperty,
  editor: SourceEditor
): Extract<RenderResolution, { kind: 'resolved' | 'unresolved' }> {
  if (renderProperty.method || renderProperty.kind !== 'init') {
    return methodRender(renderProperty);
  }

  const render = renderProperty.value;

  if (render.type === 'Identifier') {
    const resolved = resolveIdentifierInit(editor.program, render.name);
    return isRenderFunction(resolved)
      ? { kind: 'resolved', node: resolved }
      : { kind: 'unresolved' };
  }

  if (!isRenderFunction(render)) {
    throw storyShapeError(
      'Expected render to be an arrow function or function expression',
      render,
      editor
    );
  }

  return { kind: 'resolved', node: render };
}
