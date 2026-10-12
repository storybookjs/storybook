import { type NodePath, types as t } from 'storybook/internal/babel';
import { ARG_PATH_PATTERN } from 'storybook/internal/docs-tools';

import { omitComment } from '../docs/template-format.ts';

export type StoryFunction =
  | t.ArrowFunctionExpression
  | t.FunctionExpression
  | t.FunctionDeclaration
  | t.ObjectMethod;

const ARGS = 'args';

// The story as written, reading its args only as `args.name` and `{...args}`, for `fillTemplate`.
// `undefined` when the preview could not fill it, such as when `args` is passed along whole or a
// string reads like an arg path; the static snippet covers those.
export function buildStoryTemplate(
  storyName: string,
  fnPath: NodePath<StoryFunction> | undefined,
  componentName: string | undefined
): t.VariableDeclaration | t.FunctionDeclaration | undefined {
  if (!fnPath) {
    if (!componentName) {
      return undefined;
    }
    const element = t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier(componentName), [argsSpread([])], true),
      null,
      [],
      true
    );
    return arrowStory(storyName, withChildrenHole(element), false);
  }

  const replacements = argReplacements(fnPath);
  if (!replacements || hasArgPathText(fnPath)) {
    return undefined;
  }

  const fn = fnPath.node;
  const body = replaceNodes(fn.body, replacements);
  return t.isFunctionDeclaration(fn)
    ? t.functionDeclaration(t.identifier(storyName), [], body as t.BlockStatement, false, fn.async)
    : arrowStory(storyName, body, fn.async);
}

const arrowStory = (storyName: string, body: t.BlockStatement | t.Expression, async: boolean) =>
  t.variableDeclaration('const', [
    t.variableDeclarator(t.identifier(storyName), t.arrowFunctionExpression([], body, async)),
  ]);

// A node to put in place, `null` to drop it from its list, or a rewrite of it after its own
// descendants were replaced.
type Replacement = t.Node | null | ((node: t.Node) => t.Node);
type Replacements = Map<t.Node, Replacement>;

function argReplacements(fnPath: NodePath<StoryFunction>): Replacements | undefined {
  const [param] = fnPath.get('params') as NodePath[];
  if (!param) {
    return undefined;
  }

  const replacements: Replacements = new Map();
  const ownReferences = new Set<t.Node>();
  const argReferences: NodePath<t.Identifier>[] = [];

  if (param.isIdentifier()) {
    const binding = fnPath.scope.getBinding(param.node.name);
    if (!binding || binding.constantViolations.length > 0) {
      return undefined;
    }
    for (const reference of binding.referencePaths) {
      ownReferences.add(reference.node);
      const declarator = reference.parentPath;
      if (declarator?.isVariableDeclarator() && declarator.node.init === reference.node) {
        if (!destructure(declarator.get('id'), replacements) || !drop(declarator, replacements)) {
          return undefined;
        }
      } else if (reference.isIdentifier() && readsArgData(reference)) {
        argReferences.push(reference);
      } else {
        return undefined;
      }
    }
  } else if (!destructure(param, replacements)) {
    return undefined;
  }

  if (replacements.size === 0 && argReferences.length === 0) {
    return undefined;
  }
  // `args` may only name the parameter, or the template would fill a variable it does not own.
  if (namesOtherArgs(fnPath, param.node, ownReferences)) {
    return undefined;
  }

  for (const reference of argReferences) {
    if (reference.parentPath.isJSXSpreadAttribute()) {
      const element = reference.findParent((path) => path.isJSXElement())!.node as t.JSXElement;
      replacements.set(element, (node) => spreadElement(node as t.JSXElement, ownReferences));
    } else if (reference.node.name !== ARGS) {
      replacements.set(reference.node, t.identifier(ARGS));
    }
  }
  return replacements;
}

function drop(declarator: NodePath<t.VariableDeclarator>, replacements: Replacements) {
  const declaration = declarator.parentPath;
  if (!declaration.isVariableDeclaration() || !declaration.parentPath.isBlockStatement()) {
    return false;
  }
  const lone = declaration.node.declarations.length === 1;
  replacements.set(lone ? declaration.node : declarator.node, null);
  return true;
}

function readsArgData(reference: NodePath<t.Identifier>) {
  const { parentPath } = reference;
  if (parentPath?.isJSXSpreadAttribute()) {
    return true;
  }
  return (
    (parentPath?.isMemberExpression() || parentPath?.isOptionalMemberExpression()) &&
    parentPath.node.object === reference.node &&
    (!parentPath.node.computed ||
      t.isStringLiteral(parentPath.node.property) ||
      t.isNumericLiteral(parentPath.node.property))
  );
}

// Fails for patterns that cannot be written as `args.name`: defaults, rest, nesting.
function destructure(pattern: NodePath, replacements: Replacements): boolean {
  if (!pattern.isObjectPattern()) {
    return false;
  }
  for (const property of pattern.get('properties')) {
    if (!property.isObjectProperty() || property.node.computed) {
      return false;
    }
    const { key, value } = property.node;
    const name = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : undefined;
    if (name === undefined || !t.isIdentifier(value)) {
      return false;
    }
    const binding = pattern.scope.getBinding(value.name);
    if (!binding || binding.constantViolations.length > 0) {
      return false;
    }
    for (const reference of binding.referencePaths) {
      const member = argMember(name);
      const shorthand = reference.parentPath;
      if (shorthand?.isObjectProperty() && shorthand.node.shorthand) {
        replacements.set(shorthand.node, t.objectProperty(shorthand.node.key, member));
      } else {
        replacements.set(reference.node, member);
      }
    }
  }
  return true;
}

const argMember = (name: string) =>
  t.isValidIdentifier(name)
    ? t.memberExpression(t.identifier(ARGS), t.identifier(name))
    : t.memberExpression(t.identifier(ARGS), t.stringLiteral(name), true);

function namesOtherArgs(
  fnPath: NodePath<StoryFunction>,
  param: t.Node,
  ownReferences: ReadonlySet<t.Node>
) {
  const declaresOtherArgs = (scope: NodePath['scope']) => {
    const binding = scope.getOwnBinding(ARGS);
    return binding !== undefined && binding.path.node !== param;
  };
  let found = declaresOtherArgs(fnPath.scope);
  fnPath.get('body').traverse({
    Identifier(path) {
      if (
        path.node.name === ARGS &&
        path.isReferencedIdentifier() &&
        !ownReferences.has(path.node)
      ) {
        found = true;
        path.stop();
      }
    },
    Scope(path) {
      if (declaresOtherArgs(path.scope)) {
        found = true;
        path.stop();
      }
    },
  });
  return found;
}

const ARG_PATH = new RegExp(ARG_PATH_PATTERN);

function hasArgPathText(fnPath: NodePath<StoryFunction>) {
  let found = false;
  const check = (path: NodePath, text: string) => {
    if (ARG_PATH.test(text)) {
      found = true;
      path.stop();
    }
  };
  fnPath.get('body').traverse({
    StringLiteral: (path) => check(path, path.node.value),
    JSXText: (path) => check(path, path.node.value),
    TemplateElement: (path) => check(path, path.node.value.raw),
  });
  return found;
}

// The props written after the spread override it, so the filled spread leaves them out.
function spreadElement(element: t.JSXElement, ownReferences: ReadonlySet<t.Node>): t.JSXElement {
  const { attributes } = element.openingElement;
  const opening = {
    ...element.openingElement,
    attributes: attributes.map((attribute, index) =>
      t.isJSXSpreadAttribute(attribute) && ownReferences.has(attribute.argument)
        ? argsSpread(attributeNames(attributes.slice(index + 1)))
        : attribute
    ),
  };
  return withChildrenHole({ ...element, openingElement: opening });
}

const attributeNames = (attributes: t.JSXOpeningElement['attributes']) =>
  attributes.flatMap((attribute) =>
    t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name) ? [attribute.name.name] : []
  );

function argsSpread(omitted: readonly string[]) {
  const args = t.identifier(ARGS);
  if (omitted.length > 0) {
    // recast prints `comments`, not babel's `trailingComments`.
    Object.assign(args, {
      comments: [
        { type: 'CommentBlock', value: omitComment(omitted), leading: false, trailing: true },
      ],
    });
  }
  return t.jsxSpreadAttribute(args);
}

function withChildrenHole(element: t.JSXElement): t.JSXElement {
  if (element.children.length > 0) {
    return element;
  }
  const name = element.openingElement.name;
  return {
    ...element,
    openingElement: { ...element.openingElement, selfClosing: false },
    closingElement: t.jsxClosingElement(name),
    children: [t.jsxExpressionContainer(argMember('children'))],
  };
}

function replaceNodes<T extends t.Node>(node: T, replacements: Replacements): T {
  const replacement = replacements.get(node);
  if (replacement && typeof replacement !== 'function') {
    return replacement as T;
  }
  let copy: Record<string, unknown> | undefined;
  for (const key of t.VISITOR_KEYS[node.type] ?? []) {
    const child = (node as unknown as Record<string, unknown>)[key];
    const next = Array.isArray(child)
      ? replaceInList(child, replacements)
      : isNode(child)
        ? replaceNodes(child, replacements)
        : child;
    if (next !== child) {
      copy ??= { ...node };
      copy[key] = next;
    }
  }
  const replaced = (copy ?? node) as T;
  return typeof replacement === 'function' ? (replacement(replaced) as T) : replaced;
}

function replaceInList(list: unknown[], replacements: Replacements): unknown[] {
  const next = list.flatMap((item) => {
    if (!isNode(item)) {
      return [item];
    }
    return replacements.get(item) === null ? [] : [replaceNodes(item, replacements)];
  });
  return next.length === list.length && next.every((item, index) => item === list[index])
    ? list
    : next;
}

const isNode = (value: unknown): value is t.Node =>
  typeof value === 'object' && value !== null && typeof (value as t.Node).type === 'string';
