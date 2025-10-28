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
  storyDeclaration: NodePath<t.VariableDeclarator | t.FunctionDeclaration>,
  storyName: string,
  metaObj: t.ObjectExpression | null | undefined,
  componentName?: string
): t.VariableDeclaration | t.FunctionDeclaration {
  let storyPath: NodePath<t.FunctionDeclaration | t.Expression>;

  if (storyDeclaration.isFunctionDeclaration()) {
    storyPath = storyDeclaration;
  } else if (storyDeclaration.isVariableDeclarator()) {
    const init = storyDeclaration.get('init');
    invariant(
      init.isExpression(),
      () =>
        storyDeclaration.buildCodeFrameError('Expected story initializer to be an expression')
          .message
    );
    storyPath = init;
  } else {
    throw storyDeclaration.buildCodeFrameError(
      'Expected story to be a function or variable declaration'
    );
  }

  let normalizedPath: NodePath<t.FunctionDeclaration | t.Expression> = storyPath;

  if (storyPath.isCallExpression()) {
    const callee = storyPath.get('callee');
    // Handle Template.bind({}) pattern by resolving the identifier's initialization
    if (callee.isMemberExpression()) {
      const obj = callee.get('object');
      const prop = callee.get('property');
      const isBind =
        (prop.isIdentifier() && prop.node.name === 'bind') ||
        (t.isStringLiteral((prop as any).node) &&
          ((prop as any).node as t.StringLiteral).value === 'bind');
      if (obj.isIdentifier() && isBind) {
        const resolved = resolveBindIdentifierInit(storyDeclaration, obj);
        if (resolved) {
          normalizedPath = resolved;
        }
      }
    }

    // Fallback: treat call expression as story factory and use first argument
    if (storyPath === normalizedPath) {
      const args = storyPath.get('arguments');
      invariant(
        args.length === 1,
        () => storyPath.buildCodeFrameError('Could not evaluate story expression').message
      );
      const storyArgument = args[0];
      invariant(
        storyArgument.isExpression(),
        () => storyPath.buildCodeFrameError('Could not evaluate story expression').message
      );
      normalizedPath = storyArgument;
    }
  }

  normalizedPath = normalizedPath.isTSSatisfiesExpression()
    ? normalizedPath.get('expression')
    : normalizedPath.isTSAsExpression()
      ? normalizedPath.get('expression')
      : normalizedPath;

  // If the story is already a function, try to inline args like in render() when using `{...args}`
  let storyFn:
    | NodePath<t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration>
    | undefined;

  if (
    normalizedPath.isArrowFunctionExpression() ||
    normalizedPath.isFunctionExpression() ||
    normalizedPath.isFunctionDeclaration()
  ) {
    storyFn = normalizedPath;
  } else if (!normalizedPath.isObjectExpression()) {
    throw normalizedPath.buildCodeFrameError(
      'Expected story to be csf factory, function or an object expression'
    );
  }

  const storyProperties = normalizedPath?.isObjectExpression()
    ? normalizedPath.get('properties').filter((p) => p.isObjectProperty())
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

  if (renderPath) {
    storyFn = renderPath;
  }

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

    // Handle arrow function returning JSX directly: () => <Button {...args} />
    if (t.isArrowFunctionExpression(fn) && t.isJSXElement(fn.body)) {
      const body = fn.body;

      const spreadTransformed = transformArgsSpreadsInJsx(body, merged);
      const inlined = inlineArgsInJsx(spreadTransformed.node, merged);

      if (spreadTransformed.changed || inlined.changed) {
        const newFn = t.arrowFunctionExpression([], inlined.node as t.Expression, fn.async);
        return t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(storyName), newFn),
        ]);
      }
    }

    // Handle functions or arrow functions with block bodies
    const body = t.isFunctionDeclaration(fn)
      ? fn.body.body
      : t.isArrowFunctionExpression(fn) && t.isBlockStatement(fn.body)
        ? fn.body.body
        : t.isFunctionExpression(fn) && t.isBlockStatement(fn.body)
          ? fn.body.body
          : undefined;
    if (body) {
      let changed = false;

      const newBody = body.map((stmt) => {
        // Only transform return statements that return JSX
        if (t.isReturnStatement(stmt) && stmt.argument && t.isJSXElement(stmt.argument)) {
          const spreadTransformed = transformArgsSpreadsInJsx(stmt.argument, merged);
          const inlined = inlineArgsInJsx(spreadTransformed.node, merged);

          if (spreadTransformed.changed || inlined.changed) {
            changed = true;
            return t.returnStatement(inlined.node as t.Expression);
          }
        }
        return stmt;
      });

      if (changed) {
        if (t.isFunctionDeclaration(fn)) {
          return t.functionDeclaration(
            fn.id,
            [],
            t.blockStatement(newBody),
            fn.generator,
            fn.async
          );
        } else {
          return t.variableDeclaration('const', [
            t.variableDeclarator(
              t.identifier(storyName),
              t.arrowFunctionExpression([], t.blockStatement(newBody), fn.async)
            ),
          ]);
        }
      }
    }
    // Default fallback: wrap whatever function node we have
    if (t.isFunctionDeclaration(fn)) {
      return fn;
    } else {
      return t.variableDeclaration('const', [t.variableDeclarator(t.identifier(storyName), fn)]);
    }
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

  return t.variableDeclaration('const', [t.variableDeclarator(t.identifier(storyName), arrow)]);
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

  const toChild = (
    v: t.Node
  ): t.JSXElement | t.JSXFragment | t.JSXExpressionContainer | t.JSXText => {
    if (t.isJSXElement(v) || t.isJSXFragment(v)) {
      return v;
    }

    if (t.isJSXText(v)) {
      return v;
    }

    if (t.isStringLiteral(v)) {
      return t.jsxText(v.value);
    }
    // pretty print plain strings // pretty print plain strings
    return t.jsxExpressionContainer(v as any);
  };

  if (t.isJSXElement(node)) {
    const opening = node.openingElement;
    const attrs = opening.attributes;

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
        continue;
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

    // --- Recurse into children ---
    let newChildren: (t.JSXText | t.JSXExpressionContainer | t.JSXElement | t.JSXFragment)[] = [];

    for (const c of node.children) {
      if (t.isJSXElement(c) || t.isJSXFragment(c)) {
        const res = transformArgsSpreadsInJsx(c, merged);
        changed = changed || res.changed;
        newChildren.push(res.node as any);
      } else {
        newChildren.push(c as any);
      }
    }

    // ✅ Only inject children if {...args} was present and no children exist yet
    if (sawArgsSpread && newChildren.length === 0 && merged.children) {
      newChildren = [toChild(merged.children)];
      changed = true;
    }

    const shouldSelfClose = newChildren.length === 0;
    const newOpening = t.jsxOpeningElement(opening.name, newAttrs, shouldSelfClose);
    const newClosing = shouldSelfClose
      ? null
      : (node.closingElement ?? t.jsxClosingElement(opening.name));
    const newEl = t.jsxElement(newOpening, newClosing, newChildren, shouldSelfClose);
    return { node: newEl, changed };
  }

  // --- JSXFragment recursion ---
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
  storyPath: NodePath<t.Node>,
  identifier: NodePath<t.Identifier>
): NodePath<t.Expression> | null {
  const programPath = storyPath.findParent((p) => p.isProgram());

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
