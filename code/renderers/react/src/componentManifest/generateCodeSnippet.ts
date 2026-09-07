import { type NodePath, types as t } from 'storybook/internal/babel';
import {
  createStoryArgsResolver,
  type CsfFile,
  type ImportRef,
  metaObjectPath,
  normalizeStoryDeclaration,
  type ReferenceContext,
  type RenderResolution,
  resolveRenderFunction,
  type StoryArgsResolver,
} from 'storybook/internal/csf-tools';

import { invariant } from './utils.ts';

function renderFunctionOf(resolution: RenderResolution) {
  if (resolution.kind === 'resolved') {
    return resolution.path;
  }
  return resolution.kind === 'unresolved' ? resolution.shadowedRender : undefined;
}

/** A story's snippet, and what showing it as a complete example still depends on. */
export interface CodeSnippet {
  node: t.VariableDeclaration | t.FunctionDeclaration;
  /** Imports the snippet needs beyond the component, from arg values that kept a name. */
  imports: ImportRef[];
  /** What a static pass could not read, in the source text it was written as. */
  unresolved: string[];
}

export function getCodeSnippet(
  csf: CsfFile,
  storyName: string,
  componentName?: string,
  resolver: StoryArgsResolver = createStoryArgsResolver(csf)
): CodeSnippet {
  const { args, imports, unresolved } = resolver.resolve(storyName);
  return {
    node: buildSnippetNode(csf, storyName, componentName, args, resolver.ctx),
    imports,
    unresolved,
  };
}

function buildSnippetNode(
  csf: CsfFile,
  storyName: string,
  componentName: string | undefined,
  merged: Record<string, t.Node>,
  ctx: ReferenceContext
): t.VariableDeclaration | t.FunctionDeclaration {
  const storyDeclaration = csf._storyDeclarationPath[storyName];

  if (!storyDeclaration) {
    const message = 'Expected story to be a function or variable declaration';
    throw csf._storyPaths[storyName]?.buildCodeFrameError(message) ?? message;
  }

  const normalizedStory = normalizeStoryDeclaration(storyDeclaration);

  // Find a function (explicit story fn or render())
  let storyFn:
    | NodePath<
        t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration | t.ObjectMethod
      >
    | undefined;

  if (normalizedStory.type === 'fn') {
    storyFn = normalizedStory.path;
  }

  const storyConfigPath = normalizedStory.type === 'config' ? normalizedStory.path : undefined;

  const metaRender = resolveRenderFunction(metaObjectPath(csf), storyDeclaration, ctx);
  const storyRender = resolveRenderFunction(storyConfigPath, storyDeclaration, ctx);

  // Story render takes precedence. Only fall back to meta render when the story
  // has no render property at all — NOT when it has one that couldn't be resolved.
  // A render shadowed by a later spread is still the best static guess for this manifest,
  // which degrades to synthesis rather than suppressing snippets.
  if (!storyFn) {
    storyFn =
      renderFunctionOf(storyRender) ??
      (storyRender.kind === 'missing' ? renderFunctionOf(metaRender) : undefined);
  }

  // For no-function fallback
  const entries = Object.entries(merged).filter(([k]) => k !== 'children');
  const validEntries = entries.filter(([k, v]) => isValidJsxAttrName(k) && v != null);
  const invalidEntries = entries.filter(([k, v]) => !isValidJsxAttrName(k) && v != null);
  const injectedAttrs = validEntries.map(([k, v]) => toAttr(k, v)).filter((a) => a != null);

  // If we have a function, transform returned JSX
  if (storyFn) {
    const fn = storyFn.node;

    if (t.isArrowFunctionExpression(fn) && (t.isJSXElement(fn.body) || t.isJSXFragment(fn.body))) {
      const spreadRes = transformArgsSpreadsInJsx(fn.body, merged);
      const inlineRes = inlineArgsInJsx(spreadRes.node, merged);
      if (spreadRes.changed || inlineRes.changed) {
        const newFn = t.arrowFunctionExpression(
          remainingParams(fn, inlineRes.node),
          inlineRes.node,
          fn.async
        );
        return t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(storyName), newFn),
        ]);
      }
    }

    const stmts =
      t.isFunctionDeclaration(fn) || t.isObjectMethod(fn)
        ? fn.body.body
        : t.isArrowFunctionExpression(fn) && t.isBlockStatement(fn.body)
          ? fn.body.body
          : t.isFunctionExpression(fn) && t.isBlockStatement(fn.body)
            ? fn.body.body
            : undefined;

    if (stmts) {
      let changed = false;
      const newBody = stmts.map((stmt) => {
        if (
          t.isReturnStatement(stmt) &&
          stmt.argument &&
          (t.isJSXElement(stmt.argument) || t.isJSXFragment(stmt.argument))
        ) {
          const spreadRes = transformArgsSpreadsInJsx(stmt.argument, merged);
          const inlineRes = inlineArgsInJsx(spreadRes.node, merged);
          if (spreadRes.changed || inlineRes.changed) {
            changed = true;
            return t.returnStatement(inlineRes.node);
          }
        }
        return stmt;
      });

      if (changed) {
        const body = t.blockStatement(newBody);
        const params = remainingParams(fn, body);
        return t.isFunctionDeclaration(fn)
          ? t.functionDeclaration(t.identifier(storyName), params, body, fn.generator, fn.async)
          : t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier(storyName),
                t.arrowFunctionExpression(params, body, fn.async)
              ),
            ]);
      }
    }

    return t.isFunctionDeclaration(fn)
      ? t.functionDeclaration(t.identifier(storyName), fn.params, fn.body, fn.generator, fn.async)
      : t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(storyName),
            t.isObjectMethod(fn) ? t.arrowFunctionExpression(fn.params, fn.body, fn.async) : fn
          ),
        ]);
  }

  // No function: synthesize `<Component {...attrs}/>`
  invariant(componentName, 'Could not generate snippet without component name.');
  const invalidSpread = buildInvalidSpread(invalidEntries);
  const name = t.jsxIdentifier(componentName);
  const openingElAttrs = invalidSpread ? [...injectedAttrs, invalidSpread] : injectedAttrs;

  const children = toJsxChildren(merged.children);
  const selfClosing = children.length === 0;
  const arrow = t.arrowFunctionExpression(
    [],
    t.jsxElement(
      t.jsxOpeningElement(name, openingElAttrs, selfClosing),
      selfClosing ? null : t.jsxClosingElement(name),
      children,
      selfClosing
    )
  );

  return t.variableDeclaration('const', [t.variableDeclarator(t.identifier(storyName), arrow)]);
}

type StoryFunction =
  | t.ArrowFunctionExpression
  | t.FunctionExpression
  | t.FunctionDeclaration
  | t.ObjectMethod;

/**
 * Parameters the rewritten story function still needs.
 *
 * Inlining the args removes the reason the story took an `args` parameter, so the snippet drops it
 * - unless something the rewrite could not inline still reads from it, which would leave the
 * snippet naming a binding it no longer declares.
 */
function remainingParams(fn: StoryFunction, body: t.Node): StoryFunction['params'] {
  return readsArgs(body) ? fn.params : [];
}

function readsArgs(node: t.Node): boolean {
  // A key or a member name spelled `args` names a property, not the parameter.
  const named = new Set<t.Node>();
  let reads = false;

  t.traverseFast(node, (current) => {
    if (t.isMemberExpression(current) && !current.computed) {
      named.add(current.property);
    }
    if ((t.isObjectProperty(current) || t.isObjectMethod(current)) && !current.computed) {
      named.add(current.key);
    }
    if (t.isIdentifier(current) && current.name === 'args' && !named.has(current)) {
      reads = true;
    }
  });

  return reads;
}

/** Build a spread `{...{k: v}}` for props that aren't valid JSX attributes. */
function buildInvalidSpread(entries: ReadonlyArray<[string, t.Node]>): t.JSXSpreadAttribute | null {
  if (entries.length === 0) {
    return null;
  }
  const objectProps = entries.map(([k, v]) =>
    t.objectProperty(t.stringLiteral(k), t.isExpression(v) ? v : t.identifier('undefined'))
  );
  return t.jsxSpreadAttribute(t.objectExpression(objectProps));
}

const isValidJsxAttrName = (n: string) => /^[A-Za-z_][A-Za-z0-9_:-]*$/.test(n);

const toAttr = (key: string, value: t.Node) => {
  if (t.isBooleanLiteral(value)) {
    return value.value
      ? t.jsxAttribute(t.jsxIdentifier(key), null)
      : t.jsxAttribute(t.jsxIdentifier(key), t.jsxExpressionContainer(value));
  }

  if (t.isStringLiteral(value)) {
    return t.jsxAttribute(t.jsxIdentifier(key), t.stringLiteral(value.value));
  }

  if (t.isExpression(value)) {
    return t.jsxAttribute(t.jsxIdentifier(key), t.jsxExpressionContainer(value));
  }
  return null;
};

const toJsxChildren = (node: t.Node | null | undefined) =>
  !node
    ? []
    : t.isStringLiteral(node)
      ? [t.jsxText(node.value)]
      : t.isJSXElement(node) || t.isJSXFragment(node)
        ? [node]
        : t.isExpression(node)
          ? [t.jsxExpressionContainer(node)]
          : [];

/** Return `key` if expression is `args.key` (incl. optional chaining), else `null`. */
function getArgsMemberKey(expr: t.Node) {
  if (t.isMemberExpression(expr) && t.isIdentifier(expr.object) && expr.object.name === 'args') {
    if (t.isIdentifier(expr.property) && !expr.computed) {
      return expr.property.name;
    }

    if (t.isStringLiteral(expr.property) && expr.computed) {
      return expr.property.value;
    }
  }
  if (
    t.isOptionalMemberExpression?.(expr) &&
    t.isIdentifier(expr.object) &&
    expr.object.name === 'args'
  ) {
    const prop = expr.property;

    if (t.isIdentifier(prop) && !expr.computed) {
      return prop.name;
    }

    if (t.isStringLiteral(prop) && expr.computed) {
      return prop.value;
    }
  }
  return null;
}

/** Inline `args.foo` -> actual literal/expression in attributes/children (recursively). */
function inlineArgsInJsx(
  node: t.JSXElement | t.JSXFragment,
  merged: Record<string, t.Node>
): { node: t.JSXElement | t.JSXFragment; changed: boolean } {
  let changed = false;

  if (t.isJSXElement(node)) {
    const opening = node.openingElement;

    const newAttrs = opening.attributes.flatMap<t.JSXAttribute | t.JSXSpreadAttribute>((a) => {
      if (!t.isJSXAttribute(a)) {
        return [a];
      }
      const name = t.isJSXIdentifier(a.name) ? a.name.name : null;

      if (!(name && a.value && t.isJSXExpressionContainer(a.value))) {
        return [a];
      }

      const key = getArgsMemberKey(a.value.expression);

      if (!(key && key in merged)) {
        return [a];
      }

      const repl = toAttr(name, merged[key]);
      changed = true;
      return repl ? [repl] : [];
    });

    const newChildren = node.children.flatMap<
      t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXElement | t.JSXFragment
    >((c) => {
      if (t.isJSXElement(c) || t.isJSXFragment(c)) {
        const res = inlineArgsInJsx(c, merged);
        changed ||= res.changed;
        return [res.node];
      }
      if (t.isJSXExpressionContainer(c)) {
        const key = getArgsMemberKey(c.expression);
        if (key === 'children' && merged.children) {
          changed = true;
          return toJsxChildren(merged.children);
        }
      }
      return [c];
    });

    const selfClosing = opening.selfClosing && newChildren.length === 0;
    return {
      node: t.jsxElement(
        t.jsxOpeningElement(opening.name, newAttrs, selfClosing),
        selfClosing ? null : (node.closingElement ?? t.jsxClosingElement(opening.name)),
        newChildren,
        selfClosing
      ),
      changed,
    };
  }

  const fragChildren = node.children.flatMap((c): (typeof c)[] => {
    if (t.isJSXElement(c) || t.isJSXFragment(c)) {
      const res = inlineArgsInJsx(c, merged);
      changed ||= res.changed;
      return [res.node];
    }
    if (t.isJSXExpressionContainer(c)) {
      const key = getArgsMemberKey(c.expression);
      if (key === 'children' && 'children' in merged) {
        changed = true;
        return toJsxChildren(merged.children);
      }
    }
    return [c];
  });

  return { node: t.jsxFragment(node.openingFragment, node.closingFragment, fragChildren), changed };
}

/** Expand `{...args}` into concrete attributes/children (recursively). */
function transformArgsSpreadsInJsx(
  node: t.JSXElement | t.JSXFragment,
  merged: Record<string, t.Node>
): { node: t.JSXElement | t.JSXFragment; changed: boolean } {
  let changed = false;

  const makeInjectedPieces = (
    existing: ReadonlySet<string>
  ): Array<t.JSXAttribute | t.JSXSpreadAttribute> => {
    const entries = Object.entries(merged).filter(([k, v]) => v != null && k !== 'children');
    const validEntries = entries.filter(([k]) => isValidJsxAttrName(k));
    const invalidEntries = entries.filter(([k]) => !isValidJsxAttrName(k));

    const injectedAttrs = validEntries
      .map(([k, v]) => toAttr(k, v))
      .filter((a): a is t.JSXAttribute => Boolean(a))
      .filter((a) => t.isJSXIdentifier(a.name) && !existing.has(a.name.name));

    const invalidSpread = buildInvalidSpread(invalidEntries.filter(([k]) => !existing.has(k)));
    return invalidSpread ? [...injectedAttrs, invalidSpread] : injectedAttrs;
  };

  if (t.isJSXElement(node)) {
    const opening = node.openingElement;
    const attrs = opening.attributes;

    const isArgsSpread = (a: t.JSXAttribute | t.JSXSpreadAttribute) =>
      t.isJSXSpreadAttribute(a) && t.isIdentifier(a.argument) && a.argument.name === 'args';

    const sawArgsSpread = attrs.some(isArgsSpread);
    const firstIdx = attrs.findIndex(isArgsSpread);
    const nonArgsAttrs = attrs.filter((a) => !isArgsSpread(a));
    const insertionIndex = sawArgsSpread
      ? attrs.slice(0, firstIdx).filter((a) => !isArgsSpread(a)).length
      : 0;

    const newAttrs = sawArgsSpread
      ? (() => {
          const existing = new Set(
            nonArgsAttrs
              .filter((a): a is t.JSXAttribute => t.isJSXAttribute(a))
              .flatMap((a) => (t.isJSXIdentifier(a.name) ? [a.name.name] : []))
          );
          const pieces = makeInjectedPieces(existing);
          changed = true;
          return [
            ...nonArgsAttrs.slice(0, insertionIndex),
            ...pieces,
            ...nonArgsAttrs.slice(insertionIndex),
          ];
        })()
      : nonArgsAttrs;

    const newChildren = node.children.flatMap((c): (typeof c)[] => {
      if (t.isJSXElement(c) || t.isJSXFragment(c)) {
        const res = transformArgsSpreadsInJsx(c, merged);
        changed ||= res.changed;
        return [res.node];
      }
      return [c];
    });

    const children =
      sawArgsSpread && newChildren.length === 0 && merged.children
        ? ((changed = true), toJsxChildren(merged.children))
        : newChildren;

    const selfClosing = children.length === 0;
    return {
      node: t.jsxElement(
        t.jsxOpeningElement(opening.name, newAttrs, selfClosing),
        selfClosing ? null : (node.closingElement ?? t.jsxClosingElement(opening.name)),
        children,
        selfClosing
      ),
      changed,
    };
  }

  const fragChildren = node.children.flatMap((c): (typeof c)[] => {
    if (t.isJSXElement(c) || t.isJSXFragment(c)) {
      const res = transformArgsSpreadsInJsx(c, merged);
      changed ||= res.changed;
      return [res.node];
    }
    return [c];
  });

  return { node: t.jsxFragment(node.openingFragment, node.closingFragment, fragChildren), changed };
}
