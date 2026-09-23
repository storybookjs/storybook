import { babelParse, recast, traverse, types as t } from 'storybook/internal/babel';

const REACT_DOM_SHIM = '@storybook/react-dom-shim';
const REACT_DOM_SHIM_PRESET = `${REACT_DOM_SHIM}/preset`;
const LEGACY_REPLACEMENTS = new Set([
  `${REACT_DOM_SHIM}/react-16`,
  `${REACT_DOM_SHIM}/dist/react-16`,
]);

export type ReactDomShimConfigAnalysis =
  | { kind: 'unchanged' }
  | { kind: 'changed'; source: string }
  | { kind: 'manual'; source: string; diagnostic: string };

type StaticConfig = {
  object: t.ObjectExpression;
  kind: 'main' | 'vite';
};

type CommentedNode = t.Node & { comments?: t.Comment[] | null };

const isShimSource = (value: string) =>
  value === REACT_DOM_SHIM || value.startsWith(`${REACT_DOM_SHIM}/`);

const propertyName = (property: t.ObjectProperty): string | undefined => {
  if (property.computed) {
    return undefined;
  }

  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }

  return t.isStringLiteral(property.key) ? property.key.value : undefined;
};

const getProperty = (object: t.ObjectExpression, name: string): t.ObjectProperty | undefined =>
  object.properties.find(
    (property): property is t.ObjectProperty =>
      t.isObjectProperty(property) && propertyName(property) === name
  );

const hasTopLevelModuleBinding = (program: t.Program): boolean =>
  program.body.some((statement) => {
    if (t.isVariableDeclaration(statement)) {
      return statement.declarations.some((declaration) =>
        t.isIdentifier(declaration.id, { name: 'module' })
      );
    }
    return (
      (t.isFunctionDeclaration(statement) || t.isClassDeclaration(statement)) &&
      t.isIdentifier(statement.id, { name: 'module' })
    );
  });

const hasStaticUniqueProperties = (object: t.ObjectExpression): boolean => {
  const names = new Set<string>();
  return object.properties.every((property) => {
    if (!t.isObjectProperty(property)) {
      return false;
    }
    const name = propertyName(property);
    if (!name || names.has(name)) {
      return false;
    }
    names.add(name);
    return true;
  });
};

const isMainConfigFile = (filePath: string) => /(^|[/\\])main\.[cm]?[jt]sx?$/.test(filePath);

const isViteConfigFile = (filePath: string) =>
  /(^|[/\\])vite(?:st)?\.config\.[cm]?[jt]sx?$/.test(filePath);

const getStaticConfig = (program: t.Program, filePath: string): StaticConfig | undefined => {
  const kind = isMainConfigFile(filePath)
    ? 'main'
    : isViteConfigFile(filePath)
      ? 'vite'
      : undefined;
  if (!kind) {
    return undefined;
  }

  const hasCommonJsExport = program.body.some(
    (statement) =>
      t.isExpressionStatement(statement) &&
      t.isAssignmentExpression(statement.expression) &&
      t.isMemberExpression(statement.expression.left) &&
      !statement.expression.left.computed &&
      t.isIdentifier(statement.expression.left.object, { name: 'module' }) &&
      t.isIdentifier(statement.expression.left.property, { name: 'exports' })
  );
  const hasDefaultExport = program.body.some((statement) =>
    t.isExportDefaultDeclaration(statement)
  );
  if (hasTopLevelModuleBinding(program) || (hasCommonJsExport && hasDefaultExport)) {
    return undefined;
  }

  for (const statement of program.body) {
    if (
      t.isExportDefaultDeclaration(statement) &&
      t.isObjectExpression(statement.declaration) &&
      hasStaticUniqueProperties(statement.declaration)
    ) {
      return { object: statement.declaration, kind };
    }

    if (
      t.isExpressionStatement(statement) &&
      t.isAssignmentExpression(statement.expression) &&
      statement.expression.operator === '=' &&
      t.isMemberExpression(statement.expression.left) &&
      !statement.expression.left.computed &&
      t.isIdentifier(statement.expression.left.object, { name: 'module' }) &&
      t.isIdentifier(statement.expression.left.property, { name: 'exports' }) &&
      t.isObjectExpression(statement.expression.right) &&
      hasStaticUniqueProperties(statement.expression.right)
    ) {
      return { object: statement.expression.right, kind };
    }
  }

  return undefined;
};

const isCommentedNode = (node: t.Node): node is CommentedNode => 'comments' in node;

const commentsOf = (node: t.Node): t.Comment[] =>
  isCommentedNode(node) ? [...(node.comments ?? [])] : [];

const setComments = (node: t.Node, comments: t.Comment[]) => {
  Object.assign(node, { comments });
};

const removedComments = (node: t.Node): t.Comment[] => {
  const comments = commentsOf(node);
  if (t.isObjectExpression(node)) {
    for (const property of node.properties) {
      comments.push(...commentsOf(property));
    }
  }
  return comments;
};

const preserveComments = (removed: t.Node, adjacent: t.Node | undefined, parent: t.Node) => {
  const comments = removedComments(removed);
  if (!comments.length) {
    return;
  }

  if (adjacent) {
    setComments(adjacent, [...comments, ...commentsOf(adjacent)]);
  } else {
    setComments(parent, [...comments, ...commentsOf(parent)]);
  }
};

const removeArrayElement = (array: t.ArrayExpression, index: number) => {
  const element = array.elements[index];
  const adjacent = array.elements[index + 1] ?? array.elements[index - 1] ?? undefined;
  if (element) {
    preserveComments(element, adjacent ?? undefined, array);
  }
  array.elements.splice(index, 1);
};

const removeObjectProperty = (object: t.ObjectExpression, index: number) => {
  const property = object.properties[index];
  const adjacent = object.properties[index + 1] ?? object.properties[index - 1] ?? undefined;
  preserveComments(property, adjacent, object);
  object.properties.splice(index, 1);
};

const manual = (source: string, filePath: string, reason: string): ReactDomShimConfigAnalysis => ({
  kind: 'manual',
  source,
  diagnostic: `${filePath}: ${reason}`,
});

const hasUnsupportedModuleUse = (program: t.Program): boolean => {
  let unsupported = false;

  traverse(program, {
    ImportDeclaration(path) {
      unsupported ||= isShimSource(path.node.source.value);
    },
    ExportNamedDeclaration(path) {
      unsupported ||= Boolean(path.node.source && isShimSource(path.node.source.value));
    },
    ExportAllDeclaration(path) {
      unsupported ||= isShimSource(path.node.source.value);
    },
    CallExpression(path) {
      if (!t.isImport(path.node.callee) && !t.isIdentifier(path.node.callee, { name: 'require' })) {
        return;
      }
      const [argument] = path.node.arguments;
      const value = t.isStringLiteral(argument)
        ? argument.value
        : t.isTemplateLiteral(argument) && argument.expressions.length === 0
          ? argument.quasis[0]?.value.cooked
          : undefined;
      unsupported ||= !value || isShimSource(value);
    },
    ImportExpression(path) {
      const source = path.node.source;
      if (t.isStringLiteral(source)) {
        unsupported ||= isShimSource(source.value);
      } else if (t.isTemplateLiteral(source) && source.expressions.length === 0) {
        const value = source.quasis[0]?.value.cooked;
        unsupported ||= Boolean(value && isShimSource(value));
      } else {
        unsupported = true;
      }
    },
  });

  return unsupported;
};

const hasShimLiteral = (program: t.Program): boolean => {
  let found = false;
  traverse(program, {
    StringLiteral(path) {
      found ||= isShimSource(path.node.value);
    },
    TemplateLiteral(path) {
      const value = path.node.expressions.length === 0 ? path.node.quasis[0]?.value.cooked : null;
      found ||= Boolean(value && isShimSource(value));
    },
  });
  return found;
};

const removeMainPreset = (config: StaticConfig): boolean | 'manual' => {
  if (config.kind !== 'main') {
    return false;
  }

  let changed = false;
  for (const name of ['addons', 'presets']) {
    const property = getProperty(config.object, name);
    if (!property) {
      continue;
    }
    if (!t.isArrayExpression(property.value)) {
      return 'manual';
    }

    for (let index = property.value.elements.length - 1; index >= 0; index -= 1) {
      const element = property.value.elements[index];
      if (t.isStringLiteral(element) && element.value === REACT_DOM_SHIM_PRESET) {
        removeArrayElement(property.value, index);
        changed = true;
      } else if (element && (t.isSpreadElement(element) || !t.isStringLiteral(element))) {
        return 'manual';
      }
    }
  }

  return changed;
};

const isLegacyAlias = (property: t.ObjectProperty): boolean =>
  propertyName(property) === REACT_DOM_SHIM &&
  t.isStringLiteral(property.value) &&
  LEGACY_REPLACEMENTS.has(property.value.value);

const isLegacyAliasEntry = (element: t.Expression | t.SpreadElement | null): boolean => {
  if (!t.isObjectExpression(element)) {
    return false;
  }
  if (!hasStaticUniqueProperties(element) || element.properties.length !== 2) {
    return false;
  }

  const find = getProperty(element, 'find');
  const replacement = getProperty(element, 'replacement');
  if (!find || !replacement) {
    return false;
  }
  return (
    t.isStringLiteral(find.value, { value: REACT_DOM_SHIM }) &&
    t.isStringLiteral(replacement.value) &&
    LEGACY_REPLACEMENTS.has(replacement.value.value)
  );
};

const isStaticAliasEntry = (element: t.Expression | t.SpreadElement | null): boolean => {
  if (!t.isObjectExpression(element) || !hasStaticUniqueProperties(element)) {
    return false;
  }
  return element.properties.every(
    (property) =>
      t.isObjectProperty(property) &&
      t.isStringLiteral(property.value) &&
      (propertyName(property) === 'find' || propertyName(property) === 'replacement')
  );
};

const removeViteAlias = (config: StaticConfig): boolean | 'manual' => {
  if (config.kind !== 'vite') {
    return false;
  }

  const resolve = getProperty(config.object, 'resolve');
  if (!resolve) {
    return false;
  }
  if (!t.isObjectExpression(resolve.value)) {
    return 'manual';
  }
  if (!hasStaticUniqueProperties(resolve.value)) {
    return 'manual';
  }

  const alias = getProperty(resolve.value, 'alias');
  if (!alias) {
    return false;
  }
  if (t.isObjectExpression(alias.value)) {
    const containsShim = alias.value.properties.some(
      (property) =>
        t.isObjectProperty(property) &&
        (propertyName(property) === REACT_DOM_SHIM ||
          (t.isStringLiteral(property.value) && isShimSource(property.value.value)))
    );
    if (!containsShim) {
      return false;
    }
    if (!hasStaticUniqueProperties(alias.value)) {
      return 'manual';
    }

    let changed = false;
    for (let index = alias.value.properties.length - 1; index >= 0; index -= 1) {
      const property = alias.value.properties[index];
      if (t.isObjectProperty(property) && isLegacyAlias(property)) {
        removeObjectProperty(alias.value, index);
        changed = true;
      }
    }
    return changed ? changed : 'manual';
  }

  if (t.isArrayExpression(alias.value)) {
    const containsShim = alias.value.elements.some((element) => isLegacyAliasEntry(element));
    if (!containsShim) {
      return 'manual';
    }
    if (alias.value.elements.some((element) => !isStaticAliasEntry(element))) {
      return 'manual';
    }

    let changed = false;
    for (let index = alias.value.elements.length - 1; index >= 0; index -= 1) {
      if (isLegacyAliasEntry(alias.value.elements[index])) {
        removeArrayElement(alias.value, index);
        changed = true;
      }
    }
    return changed ? changed : 'manual';
  }

  return 'manual';
};

export const analyzeReactDomShimConfig = (
  source: string,
  filePath: string
): ReactDomShimConfigAnalysis => {
  let ast: t.File;
  try {
    ast = babelParse(source);
  } catch {
    return manual(source, filePath, 'cannot parse this config safely');
  }

  if (hasUnsupportedModuleUse(ast.program)) {
    return manual(source, filePath, 'contains a react-dom-shim import, re-export, or module load');
  }

  if (!hasShimLiteral(ast.program)) {
    return { kind: 'unchanged' };
  }

  const config = getStaticConfig(ast.program, filePath);
  if (!config) {
    return manual(source, filePath, 'does not have a supported static config export');
  }

  const mainResult = removeMainPreset(config);
  if (mainResult === 'manual') {
    return manual(source, filePath, 'uses a non-literal Storybook presets or addons entry');
  }
  const aliasResult = removeViteAlias(config);
  if (aliasResult === 'manual') {
    return manual(source, filePath, 'uses an unsafe react-dom-shim alias');
  }

  if (!mainResult && !aliasResult) {
    return manual(source, filePath, 'uses react-dom-shim outside a supported config entry');
  }

  if (hasShimLiteral(ast.program)) {
    return manual(
      source,
      filePath,
      'contains another react-dom-shim reference that cannot be removed safely'
    );
  }

  return {
    kind: 'changed',
    source: recast.print(ast, { lineTerminator: '\n' }).code,
  };
};
