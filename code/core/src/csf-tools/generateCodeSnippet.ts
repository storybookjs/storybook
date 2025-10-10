import { type NodePath, types as t } from 'storybook/internal/babel';

import invariant from 'tiny-invariant';

import { type CsfFile } from './CsfFile';

function buildInvalidSpread(entries: Array<[string, t.Node]>): t.JSXSpreadAttribute | null {
  if (entries.length === 0) return null;
  const objectProps = entries.map(([k, v]) =>
    t.objectProperty(
      t.stringLiteral(k),
      t.isExpression(v) ? v : (t.identifier('undefined') as t.Expression)
    )
  );
  return t.jsxSpreadAttribute(t.objectExpression(objectProps));
}

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

  // If the story is already a function, try to inline args like in render() when using `{...args}`

  // Otherwise it must be an object story
  const storyObjPath =
    story?.isArrowFunctionExpression() || story?.isFunctionExpression() ? null : story;
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

  const storyFn = renderPath ?? story;

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

  const entries = Object.entries(merged).filter(([k]) => k !== 'children');
  const validEntries = entries.filter(([k, v]) => isValidJsxAttrName(k) && v != null);
  const invalidEntries = entries.filter(([k, v]) => !isValidJsxAttrName(k) && v != null);

  const injectedAttrs = validEntries
    .map(([k, v]) => toAttr(k, v))
    .filter((a): a is t.JSXAttribute => Boolean(a));

  if (storyFn?.isArrowFunctionExpression() || storyFn?.isFunctionExpression()) {
    const fn = storyFn.node;

    // Only handle arrow function with direct JSX expression body for now
    if (t.isArrowFunctionExpression(fn) && t.isJSXElement(fn.body)) {
      const body = fn.body;
      const opening = body.openingElement;
      const attrs = opening.attributes;
      const firstSpreadIndex = attrs.findIndex(
        (a) => t.isJSXSpreadAttribute(a) && t.isIdentifier(a.argument) && a.argument.name === 'args'
      );
      if (firstSpreadIndex !== -1) {
        // Build a list of non-args attributes and compute insertion index at the position of the first args spread
        const nonArgsAttrs: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [];
        let insertionIndex = 0;
        for (let i = 0; i < attrs.length; i++) {
          const a = attrs[i]!;
          const isArgsSpread =
            t.isJSXSpreadAttribute(a) && t.isIdentifier(a.argument) && a.argument.name === 'args';
          if (isArgsSpread) {
            if (i === firstSpreadIndex) {
              insertionIndex = nonArgsAttrs.length;
            }
            continue; // drop all {...args}
          }
          nonArgsAttrs.push(a as any);
        }

        // Determine names of explicitly set attributes (excluding any args spreads)
        const existingAttrNames = new Set(
          nonArgsAttrs
            .filter((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name))
            .map((a) => (a as t.JSXAttribute).name.name)
        );

        // Filter out any injected attrs that would duplicate an existing explicit attribute
        const filteredInjected = injectedAttrs.filter(
          (a) => t.isJSXIdentifier(a.name) && !existingAttrNames.has(a.name.name)
        );

        // Build a spread containing only invalid-key props, if any, and also exclude keys already explicitly present
        const invalidProps = invalidEntries.filter(([k]) => !existingAttrNames.has(k));
        const invalidSpread: t.JSXSpreadAttribute | null = buildInvalidSpread(invalidProps);

        // Handle children injection from meta if the element currently has no children
        const metaChildren =
          metaArgs && Object.prototype.hasOwnProperty.call(metaArgs, 'children')
            ? (metaArgs as Record<string, t.Node>)['children']
            : undefined;
        const canInjectChildren =
          !!metaChildren && (body.children == null || body.children.length === 0);

        // Always transform when `{...args}` exists: remove spreads and empty params
        const pieces = [...filteredInjected, ...(invalidSpread ? [invalidSpread] : [])];
        const newAttrs = [
          ...nonArgsAttrs.slice(0, insertionIndex),
          ...pieces,
          ...nonArgsAttrs.slice(insertionIndex),
        ];

        const willHaveChildren = canInjectChildren ? true : (body.children?.length ?? 0) > 0;
        const shouldSelfClose = opening.selfClosing && !willHaveChildren;

        const finalOpening = t.jsxOpeningElement(opening.name, newAttrs, shouldSelfClose);
        const finalClosing = shouldSelfClose
          ? null
          : (body.closingElement ?? t.jsxClosingElement(opening.name));
        const finalChildren = canInjectChildren ? toJsxChildren(metaChildren) : body.children;

        const newBody = t.jsxElement(finalOpening, finalClosing, finalChildren, shouldSelfClose);
        const newFn = t.arrowFunctionExpression([], newBody, fn.async);
        return t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(storyId.node.name), newFn),
        ]);
      }
    }

    // Fallback: keep the function as-is
    const expr = storyFn.node; // This is already a t.Expression
    return t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(storyId.node.name), expr),
    ]);
  }

  // Build spread for invalid-only props, if any
  const invalidSpread = buildInvalidSpread(invalidEntries);

  const name = t.jsxIdentifier(componentName);

  const openingElAttrs: Array<t.JSXAttribute | t.JSXSpreadAttribute> = [
    ...injectedAttrs,
    ...(invalidSpread ? [invalidSpread] : []),
  ];

  const arrow = t.arrowFunctionExpression(
    [],
    t.jsxElement(
      t.jsxOpeningElement(name, openingElAttrs, false),
      t.jsxClosingElement(name),
      toJsxChildren(merged.children),
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
