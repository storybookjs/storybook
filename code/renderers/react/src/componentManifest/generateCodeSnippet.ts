import { type NodePath, types as t } from 'storybook/internal/babel';

import { invariant } from './utils';

function buildInvalidSpread(entries: Array<[string, t.Node]>): t.JSXSpreadAttribute | null {
  if (entries.length === 0) {
    return null;
  }
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
  componentName?: string
): t.VariableDeclaration {
  const declaration = storyExportPath.get('declaration');
  invariant(
    declaration.isVariableDeclaration(),
    () => storyExportPath.buildCodeFrameError('Expected story to be a variable declaration').message
  );

  const declarations = declaration.get('declarations');
  invariant(
    declarations.length === 1,
    storyExportPath.buildCodeFrameError('Expected one story declaration').message
  );

  const declarator = declarations[0];
  const init = declarator.get('init');
  invariant(
    init.isExpression(),
    () => declarator.buildCodeFrameError('Expected story initializer to be an expression').message
  );

  const storyId = declarator.get('id');
  invariant(
    storyId.isIdentifier(),
    () => declaration.buildCodeFrameError('Expected story to have a name').message
  );

  let normalizedInit: NodePath<t.Expression> = init;

  if (init.isCallExpression()) {
    const callee = init.get('callee');
    // Handle Template.bind({}) pattern by resolving the identifier's initialization
    if (callee.isMemberExpression()) {
      const obj = callee.get('object');
      const prop = callee.get('property');
      const isBind =
        (prop.isIdentifier() && prop.node.name === 'bind') ||
        (t.isStringLiteral((prop as any).node) &&
          ((prop as any).node as t.StringLiteral).value === 'bind');
      if (obj.isIdentifier() && isBind) {
        const resolved = resolveBindIdentifierInit(storyExportPath, obj);
        if (resolved) {
          normalizedInit = resolved;
        }
      }
    }

    // Fallback: treat call expression as story factory and use first argument
    if (init === normalizedInit) {
      const args = init.get('arguments');
      invariant(
        args.length === 1,
        () => init.buildCodeFrameError('Could not evaluate story expression').message
      );
      const storyArgument = args[0];
      invariant(
        storyArgument.isExpression(),
        () => init.buildCodeFrameError('Could not evaluate story expression').message
      );
      normalizedInit = storyArgument;
    }
  }

  normalizedInit = normalizedInit.isTSSatisfiesExpression()
    ? normalizedInit.get('expression')
    : normalizedInit.isTSAsExpression()
      ? normalizedInit.get('expression')
      : normalizedInit;

  // If the story is already a function, try to inline args like in render() when using `{...args}`

  let story: NodePath<t.ArrowFunctionExpression | t.FunctionExpression | t.ObjectExpression>;
  if (normalizedInit.isArrowFunctionExpression() || normalizedInit.isFunctionExpression()) {
    story = normalizedInit;
  } else if (normalizedInit.isObjectExpression()) {
    story = normalizedInit;
  } else {
    throw normalizedInit.buildCodeFrameError(
      'Expected story to be csf factory, function or an object expression'
    );
  }

  const storyProperties = story?.isObjectExpression()
    ? story.get('properties').filter((p) => p.isObjectProperty())
    : // Find CSF2 properties
      [];

  // Prefer an explicit render() when it is a function (arrow/function)
  const renderPath = storyProperties
    .filter((p) => keyOf(p.node) === 'render')
    .map((p) => p.get('value'))
    .find(
      (value): value is NodePath<t.ArrowFunctionExpression | t.FunctionExpression> =>
        value.isArrowFunctionExpression() || value.isFunctionExpression()
    );

  const storyFn =
    renderPath ??
    (story.isArrowFunctionExpression() ? story : story.isFunctionExpression() ? story : undefined);

  // Collect args: meta.args and story.args as Record<string, t.Node>
  const metaArgs = metaArgsRecord(metaObj ?? null);
  const storyArgsPath = storyProperties
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

  if (storyFn) {
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

        // Handle children injection if the element currently has no children, using merged children (story overrides meta)
        const mergedChildren = Object.prototype.hasOwnProperty.call(merged, 'children')
          ? merged['children']
          : undefined;
        const canInjectChildren =
          !!mergedChildren && (body.children == null || body.children.length === 0);

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
        const finalChildren = canInjectChildren ? toJsxChildren(mergedChildren) : body.children;

        let newBody = t.jsxElement(finalOpening, finalClosing, finalChildren, shouldSelfClose);
        // After handling top-level {...args}, also inline any nested args.* usages and
        // transform any nested {...args} spreads deeper in the tree.
        const inlined = inlineArgsInJsx(newBody, merged);
        const transformed = transformArgsSpreadsInJsx(inlined.node, merged);
        newBody = transformed.node as t.JSXElement;

        const newFn = t.arrowFunctionExpression([], newBody, fn.async);
        return t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(storyId.node.name), newFn),
        ]);
      }

      // No {...args} at top level; try to remove any deeper {...args} spreads in the JSX tree
      const deepSpread = transformArgsSpreadsInJsx(body, merged);
      if (deepSpread.changed) {
        // After transforming spreads, also inline any remaining args.* references across the tree
        const inlined = inlineArgsInJsx(deepSpread.node as any, merged);
        const newFn = t.arrowFunctionExpression([], inlined.node as any, fn.async);
        return t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(storyId.node.name), newFn),
        ]);
      }

      // Still no spreads transformed; inline any usages of args.* in the entire JSX tree
      const { node: transformedBody, changed } = inlineArgsInJsx(body, merged);
      if (changed) {
        const newFn = t.arrowFunctionExpression([], transformedBody, fn.async);
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

  invariant(componentName, 'Could not generate snippet without component name.');

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

const keyOf = (p: t.ObjectProperty): string | null =>
  t.isIdentifier(p.key) ? p.key.name : t.isStringLiteral(p.key) ? p.key.value : null;

const isValidJsxAttrName = (n: string) => /^[A-Za-z_][A-Za-z0-9_:-]*$/.test(n);

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
    // Keep falsy boolean attributes by rendering an explicit expression container
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

// Detects {args.key} member usage
function getArgsMemberKey(expr: t.Node): string | null {
  if (t.isMemberExpression(expr) && t.isIdentifier(expr.object) && expr.object.name === 'args') {
    if (t.isIdentifier(expr.property) && !expr.computed) {
      return expr.property.name;
    }

    if (t.isStringLiteral(expr.property) && expr.computed) {
      return expr.property.value;
    }
  }
  // Optional chaining: args?.key
  // In Babel types, this can still be a MemberExpression with optional: true or OptionalMemberExpression
  // Handle both just in case
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

function inlineAttrValueFromArg(
  attrName: string,
  argValue: t.Node
): t.JSXAttribute | null | undefined {
  // Reuse toAttr, but keep the original attribute name
  return toAttr(attrName, argValue);
}

function inlineArgsInJsx(
  node: t.JSXElement | t.JSXFragment,
  merged: Record<string, t.Node>
): { node: t.JSXElement | t.JSXFragment; changed: boolean } {
  let changed = false;

  if (t.isJSXElement(node)) {
    const opening = node.openingElement;
    // Process attributes
    const newAttrs: Array<t.JSXAttribute | t.JSXSpreadAttribute> = [];
    for (const a of opening.attributes) {
      if (t.isJSXAttribute(a)) {
        const attrName = t.isJSXIdentifier(a.name) ? a.name.name : null;
        if (attrName && a.value && t.isJSXExpressionContainer(a.value)) {
          const key = getArgsMemberKey(a.value.expression);
          if (key && Object.prototype.hasOwnProperty.call(merged, key)) {
            const repl = inlineAttrValueFromArg(attrName, merged[key]!);
            changed = true;
            if (repl) {
              newAttrs.push(repl);
            }
            continue;
          }
        }
        newAttrs.push(a);
      } else {
        // Keep spreads as-is (they might not be args)
        newAttrs.push(a);
      }
    }

    // Process children
    const newChildren: (t.JSXText | t.JSXExpressionContainer | t.JSXElement | t.JSXFragment)[] = [];
    for (const c of node.children) {
      if (t.isJSXElement(c) || t.isJSXFragment(c)) {
        const res = inlineArgsInJsx(c, merged);
        changed = changed || res.changed;
        newChildren.push(res.node as any);
      } else if (t.isJSXExpressionContainer(c)) {
        const key = getArgsMemberKey(c.expression);
        if (key === 'children' && Object.prototype.hasOwnProperty.call(merged, 'children')) {
          const injected = toJsxChildren(merged['children']);
          newChildren.push(...injected);
          changed = true;
        } else {
          newChildren.push(c);
        }
      } else {
        newChildren.push(c as any);
      }
    }

    const shouldSelfClose = opening.selfClosing && newChildren.length === 0;
    const newOpening = t.jsxOpeningElement(opening.name, newAttrs, shouldSelfClose);
    const newClosing = shouldSelfClose
      ? null
      : (node.closingElement ?? t.jsxClosingElement(opening.name));
    const newEl = t.jsxElement(newOpening, newClosing, newChildren, shouldSelfClose);
    return { node: newEl, changed };
  }

  // JSXFragment
  const fragChildren: (t.JSXText | t.JSXExpressionContainer | t.JSXElement | t.JSXFragment)[] = [];
  for (const c of node.children) {
    if (t.isJSXElement(c) || t.isJSXFragment(c)) {
      const res = inlineArgsInJsx(c, merged);
      changed = changed || res.changed;
      fragChildren.push(res.node as any);
    } else if (t.isJSXExpressionContainer(c)) {
      const key = getArgsMemberKey(c.expression);
      if (key === 'children' && Object.prototype.hasOwnProperty.call(merged, 'children')) {
        const injected = toJsxChildren(merged['children']);
        fragChildren.push(...injected);
        changed = true;
      } else {
        fragChildren.push(c);
      }
    } else {
      fragChildren.push(c as any);
    }
  }
  const newFrag = t.jsxFragment(node.openingFragment, node.closingFragment, fragChildren);
  return { node: newFrag, changed };
}

function transformArgsSpreadsInJsx(
  node: t.JSXElement | t.JSXFragment,
  merged: Record<string, t.Node>
): { node: t.JSXElement | t.JSXFragment; changed: boolean } {
  let changed = false;

  const makeInjectedPieces = (
    existingAttrNames: Set<string | t.JSXIdentifier>
  ): Array<t.JSXAttribute | t.JSXSpreadAttribute> => {
    // Normalize incoming set to a set of plain string names for reliable membership checks
    const existingNames = new Set<string>(
      Array.from(existingAttrNames).map((n) =>
        typeof n === 'string' ? n : t.isJSXIdentifier(n) ? n.name : ''
      )
    );

    const entries = Object.entries(merged).filter(([k]) => k !== 'children');
    const validEntries = entries.filter(([k, v]) => isValidJsxAttrName(k) && v != null);
    const invalidEntries = entries.filter(([k, v]) => !isValidJsxAttrName(k) && v != null);

    const injectedAttrs = validEntries
      .map(([k, v]) => toAttr(k, v))
      .filter((a): a is t.JSXAttribute => Boolean(a));

    const filteredInjected = injectedAttrs.filter(
      (a) => t.isJSXIdentifier(a.name) && !existingNames.has(a.name.name)
    );

    const invalidProps = invalidEntries.filter(([k]) => !existingNames.has(k));
    const invalidSpread = buildInvalidSpread(invalidProps);

    return [...filteredInjected, ...(invalidSpread ? [invalidSpread] : [])];
  };

  if (t.isJSXElement(node)) {
    const opening = node.openingElement;
    const attrs = opening.attributes;

    // Collect non-args attrs, track first insertion index, and whether we saw any args spreads
    const nonArgsAttrs: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [];
    let insertionIndex = 0;
    let sawArgsSpread = false;

    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i]!;
      const isArgsSpread =
        t.isJSXSpreadAttribute(a) && t.isIdentifier(a.argument) && a.argument.name === 'args';
      if (isArgsSpread) {
        if (!sawArgsSpread) {
          insertionIndex = nonArgsAttrs.length;
        }
        sawArgsSpread = true;
        continue; // drop all {...args}
      }
      nonArgsAttrs.push(a as any);
    }

    let newAttrs = nonArgsAttrs;
    if (sawArgsSpread) {
      const existingAttrNames = new Set(
        nonArgsAttrs
          .filter((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name))
          .map((a) => (a as t.JSXAttribute).name.name)
      );

      const pieces = makeInjectedPieces(existingAttrNames);
      newAttrs = [
        ...nonArgsAttrs.slice(0, insertionIndex),
        ...pieces,
        ...nonArgsAttrs.slice(insertionIndex),
      ];
      changed = true;
    }

    // Recurse into children
    const newChildren: (t.JSXText | t.JSXExpressionContainer | t.JSXElement | t.JSXFragment)[] = [];
    for (const c of node.children) {
      if (t.isJSXElement(c) || t.isJSXFragment(c)) {
        const res = transformArgsSpreadsInJsx(c, merged);
        changed = changed || res.changed;
        newChildren.push(res.node as any);
      } else {
        newChildren.push(c as any);
      }
    }

    const shouldSelfClose = opening.selfClosing && newChildren.length === 0;
    const newOpening = t.jsxOpeningElement(opening.name, newAttrs, shouldSelfClose);
    const newClosing = shouldSelfClose
      ? null
      : (node.closingElement ?? t.jsxClosingElement(opening.name));
    const newEl = t.jsxElement(newOpening, newClosing, newChildren, shouldSelfClose);
    return { node: newEl, changed };
  }

  // JSXFragment
  const fragChildren: (t.JSXText | t.JSXExpressionContainer | t.JSXElement | t.JSXFragment)[] = [];
  for (const c of node.children) {
    if (t.isJSXElement(c) || t.isJSXFragment(c)) {
      const res = transformArgsSpreadsInJsx(c, merged);
      changed = changed || res.changed;
      fragChildren.push(res.node as any);
    } else {
      fragChildren.push(c as any);
    }
  }
  const newFrag = t.jsxFragment(node.openingFragment, node.closingFragment, fragChildren);
  return { node: newFrag, changed };
}

// Resolve the initializer path for an identifier used in a `.bind(...)` call
function resolveBindIdentifierInit(
  storyExportPath: NodePath<t.ExportNamedDeclaration>,
  identifier: NodePath<t.Identifier>
): NodePath<t.Expression> | null {
  const programPath = storyExportPath.findParent((p) => p.isProgram());

  if (!programPath) {
    return null;
  }

  const declarators = (programPath.get('body') as NodePath[]) // statements
    .flatMap((stmt) => {
      if ((stmt as NodePath<t.VariableDeclaration>).isVariableDeclaration()) {
        return (stmt as NodePath<t.VariableDeclaration>).get(
          'declarations'
        ) as NodePath<t.VariableDeclarator>[];
      }
      if ((stmt as NodePath<t.ExportNamedDeclaration>).isExportNamedDeclaration()) {
        const decl = (stmt as NodePath<t.ExportNamedDeclaration>).get(
          'declaration'
        ) as NodePath<t.Declaration>;
        if (decl && decl.isVariableDeclaration()) {
          return decl.get('declarations') as NodePath<t.VariableDeclarator>[];
        }
      }
      return [] as NodePath<t.VariableDeclarator>[];
    });

  const match = declarators.find((d) => {
    const id = d.get('id');
    return id.isIdentifier() && id.node.name === identifier.node.name;
  });

  if (!match) {
    return null;
  }
  const init = match.get('init') as NodePath<t.Expression> | null;
  return init && init.isExpression() ? init : null;
}
