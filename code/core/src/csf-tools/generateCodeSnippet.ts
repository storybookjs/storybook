import { type NodePath, types as t } from 'storybook/internal/babel';

import invariant from 'tiny-invariant';

import { type CsfFile } from './CsfFile';

export function getCodeSnippet(
  storyExportPath: NodePath<t.ExportNamedDeclaration>,
  metaObj: t.ObjectExpression | null | undefined,
  componentName: string
): t.VariableDeclaration {
  const declaration = storyExportPath.get('declaration') as NodePath<t.Declaration>;
  invariant(declaration.isVariableDeclaration(), 'Expected variable declaration');

  const declarator = declaration.get('declarations')[0] as NodePath<t.VariableDeclarator>;
  const init = declarator.get('init') as NodePath<t.Expression>;
  invariant(init.isExpression(), 'Expected story initializer to be an expression');

  const storyId = declarator.get('id');
  invariant(storyId.isIdentifier(), 'Expected named const story export');

  let story: NodePath<t.Expression> | null = init;

  if (init.isCallExpression()) {
    const args = init.get('arguments');
    if (args.length === 0) {
      story = null;
    }
    const storyArgument = args[0];
    invariant(storyArgument.isExpression());
    story = storyArgument;
  }

  // If the story is already a function, keep it as-is.
  if (story?.isArrowFunctionExpression() || story?.isFunctionExpression()) {
    const expr = story.node; // This is already a t.Expression
    return t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(storyId.node.name), expr),
    ]);
  }

  // Otherwise it must be an object story
  const storyObjPath = story;
  invariant(
    storyObjPath === null || storyObjPath.isObjectExpression(),
    'Expected story init to be object or function'
  );

  // Prefer an explicit render() when it is a function (arrow/function)
  const renderPath = storyObjPath
    ?.get('properties')
    .filter((p) => p.isObjectProperty())
    .filter((p) => keyOf(p.node) === 'render')
    .map((p) => p.get('value'))
    .find((value) => value.isExpression());

  if (renderPath) {
    const expr = renderPath.node; // t.Expression
    return t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(storyId.node.name), expr),
    ]);
  }

  // Collect args: meta.args and story.args as Record<string, t.Node>
  const metaArgs = metaArgsRecord(metaObj ?? null);
  const storyArgsPath = storyObjPath
    ?.get('properties')
    .filter((p) => p.isObjectProperty())
    .filter((p) => keyOf(p.node) === 'args')
    .map((p) => p.get('value'))
    .find((value) => value.isObjectExpression());

  const storyArgs = argsRecordFromObjectPath(storyArgsPath);

  // Merge (story overrides meta)
  const merged: Record<string, t.Node> = { ...metaArgs, ...storyArgs };

  // Split children from attrs
  const childrenNode = merged['children'];
  const attrs = Object.entries(merged)
    .filter(([k, v]) => k !== 'children' && isValidJsxAttrName(k) && v != null)
    .map(([k, v]) => toAttr(k, v))
    .filter((a): a is t.JSXAttribute => Boolean(a));

  const name = t.jsxIdentifier(componentName);

  const arrow = t.arrowFunctionExpression(
    [],
    t.jsxElement(
      t.jsxOpeningElement(name, attrs, false),
      t.jsxClosingElement(name),
      toJsxChildren(childrenNode),
      false
    )
  );

  return t.variableDeclaration('const', [
    t.variableDeclarator(t.identifier(storyId.node.name), arrow),
  ]);
}

export function getAllCodeSnippets(csf: CsfFile) {
  const component = csf._meta?.component ?? 'Unknown';

  const snippets = Object.values(csf._storyPaths)
    .map((path: NodePath<t.ExportNamedDeclaration>) =>
      getCodeSnippet(path, csf._metaNode ?? null, component)
    )
    .filter(Boolean);

  return t.program(snippets);
}

const keyOf = (p: t.ObjectProperty): string | null =>
  t.isIdentifier(p.key) ? p.key.name : t.isStringLiteral(p.key) ? p.key.value : null;

const isValidJsxAttrName = (n: string) => /^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(n);

const argsRecordFromObjectPath = (
  objPath?: NodePath<t.ObjectExpression> | null
): Record<string, t.Node> => {
  if (!objPath) {
    return {};
  }

  const props = objPath.get('properties') as NodePath<
    t.ObjectMethod | t.ObjectProperty | t.SpreadElement
  >[];

  return Object.fromEntries(
    props
      .filter((p): p is NodePath<t.ObjectProperty> => p.isObjectProperty())
      .map((p) => [keyOf(p.node), (p.get('value') as NodePath<t.Node>).node])
      .filter(([k]) => !!k) as Array<[string, t.Node]>
  );
};

const argsRecordFromObjectNode = (objNode?: t.ObjectExpression | null): Record<string, t.Node> => {
  if (!objNode) {
    return {};
  }
  return Object.fromEntries(
    objNode.properties
      .filter((prop) => t.isObjectProperty(prop))
      .flatMap((prop) => {
        const key = keyOf(prop);
        return key ? [[key, prop.value]] : [];
      })
  );
};

const metaArgsRecord = (metaObj?: t.ObjectExpression | null): Record<string, t.Node> => {
  if (!metaObj) {
    return {};
  }
  const argsProp = metaObj.properties
    .filter((p) => t.isObjectProperty(p))
    .find((p) => keyOf(p) === 'args');

  return t.isObjectExpression(argsProp?.value) ? argsRecordFromObjectNode(argsProp.value) : {};
};

const toAttr = (key: string, value: t.Node): t.JSXAttribute | null => {
  if (t.isBooleanLiteral(value)) {
    return value.value ? t.jsxAttribute(t.jsxIdentifier(key), null) : null;
  }

  if (t.isStringLiteral(value)) {
    return t.jsxAttribute(t.jsxIdentifier(key), t.stringLiteral(value.value));
  }

  if (t.isNullLiteral(value)) {
    return null;
  }

  if (t.isIdentifier(value) && value.name === 'undefined') {
    return null;
  }

  if (t.isExpression(value)) {
    return t.jsxAttribute(t.jsxIdentifier(key), t.jsxExpressionContainer(value));
  }
  return null; // non-expression nodes are not valid as attribute values
};

const toJsxChildren = (
  node: t.Node | null | undefined
): Array<t.JSXText | t.JSXExpressionContainer | t.JSXElement | t.JSXFragment> => {
  if (!node) {
    return [];
  }

  if (t.isStringLiteral(node)) {
    return [t.jsxText(node.value)];
  }

  if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    return [node];
  }

  if (t.isExpression(node)) {
    return [t.jsxExpressionContainer(node)];
  }
  return []; // ignore non-expressions
};
