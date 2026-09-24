import { babelParse, traverse, types as t } from 'storybook/internal/babel';

import { hasShimReference, isShimSource, staticString } from './react-dom-shim.ts';

const CONFIG_FILE = /(^|[/\\])(?:main|vite(?:st)?\.config)\.[cm]?[jt]sx?$/;
const COMPONENT_FILE = /\.(?:svelte|vue)$/;
const MODULE_BUILTIN = new Set(['module', 'node:module']);

const moduleLoad = (
  callee: t.CallExpression['callee'] | t.OptionalCallExpression['callee'],
  loaders: Set<string>
): 'known' | 'unresolved' | undefined => {
  if (t.isImport(callee) || (t.isIdentifier(callee) && loaders.has(callee.name))) return 'known';
  if (
    (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee)) ||
    (!t.isIdentifier(callee.object, { name: 'require' }) &&
      !t.isIdentifier(callee.object, { name: 'module' }))
  ) {
    return undefined;
  }
  const property = callee.computed
    ? staticString(callee.property)
    : t.isIdentifier(callee.property)
      ? callee.property.name
      : undefined;
  return property === undefined
    ? 'unresolved'
    : property === 'resolve' || property === 'require'
      ? 'known'
      : undefined;
};

const isModuleFactory = (node: t.Node | null | undefined, loaders: Set<string>) =>
  t.isCallExpression(node) &&
  t.isIdentifier(node.callee) &&
  loaders.has(node.callee.name) &&
  MODULE_BUILTIN.has(staticString(node.arguments[0]) ?? '');

const memberPropertyName = (node: t.MemberExpression | t.OptionalMemberExpression) =>
  node.computed
    ? staticString(node.property)
    : t.isIdentifier(node.property)
      ? node.property.name
      : undefined;

const isCreateRequireFactory = (
  node: t.Node | null | undefined,
  factories: Set<string>,
  modules: Set<string>
) =>
  (t.isIdentifier(node) && factories.has(node.name)) ||
  ((t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
    t.isIdentifier(node.object) &&
    modules.has(node.object.name) &&
    memberPropertyName(node) === 'createRequire');

const isLoader = (
  node: t.Node | null | undefined,
  loaders: Set<string>,
  factories: Set<string>,
  modules: Set<string>
) =>
  (t.isIdentifier(node) && loaders.has(node.name)) ||
  (t.isMemberExpression(node) &&
    t.isIdentifier(node.object, { name: 'module' }) &&
    t.isIdentifier(node.property, { name: 'require' })) ||
  (t.isCallExpression(node) && isCreateRequireFactory(node.callee, factories, modules));

const loaderNames = (file: t.File): Set<string> => {
  const { program } = file;
  const loaders = new Set(['require']);
  const factories = new Set<string>();
  const modules = new Set<string>();
  const declarations: t.VariableDeclarator[] = [];
  const assignments: t.AssignmentExpression[] = [];
  traverse(file, {
    VariableDeclarator(path) {
      declarations.push(path.node);
    },
    AssignmentExpression(path) {
      assignments.push(path.node);
    },
  });
  for (const statement of program.body) {
    if (t.isImportDeclaration(statement) && MODULE_BUILTIN.has(statement.source.value)) {
      for (const specifier of statement.specifiers) {
        if (t.isImportSpecifier(specifier) && specifier.imported.name === 'createRequire') {
          factories.add(specifier.local.name);
        } else if (
          t.isImportNamespaceSpecifier(specifier) ||
          t.isImportDefaultSpecifier(specifier)
        ) {
          modules.add(specifier.local.name);
        }
      }
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    const add = (names: Set<string>, name: string) => {
      if (!names.has(name)) {
        names.add(name);
        changed = true;
      }
    };
    for (const declaration of declarations) {
      if (t.isObjectPattern(declaration.id) && isModuleFactory(declaration.init, loaders)) {
        for (const property of declaration.id.properties) {
          if (
            t.isObjectProperty(property) &&
            t.isIdentifier(property.key, { name: 'createRequire' }) &&
            t.isIdentifier(property.value)
          ) {
            add(factories, property.value.name);
          }
        }
        continue;
      }
      if (!t.isIdentifier(declaration.id)) continue;
      if (isLoader(declaration.init, loaders, factories, modules)) {
        add(loaders, declaration.id.name);
      } else if (isCreateRequireFactory(declaration.init, factories, modules)) {
        add(factories, declaration.id.name);
      }
    }
    for (const assignment of assignments) {
      if (!t.isIdentifier(assignment.left)) continue;
      if (isLoader(assignment.right, loaders, factories, modules)) {
        add(loaders, assignment.left.name);
      } else if (isCreateRequireFactory(assignment.right, factories, modules)) {
        add(factories, assignment.left.name);
      }
    }
  }
  return loaders;
};

const moduleLoadDiagnostic = (
  callee: t.CallExpression['callee'] | t.OptionalCallExpression['callee'],
  arguments_: (t.Expression | t.SpreadElement | t.JSXNamespacedName | t.ArgumentPlaceholder)[],
  filePath: string,
  loaders: Set<string>
): string | undefined => {
  const [argument] = arguments_;
  const value = staticString(argument);
  if (value && isShimSource(value)) {
    return `${filePath}: contains a react-dom-shim import, re-export, or module load`;
  }
  const kind = moduleLoad(callee, loaders);
  if (!kind) return undefined;
  return kind === 'unresolved' || !value
    ? `${filePath}: contains an unresolved module load`
    : undefined;
};

const scriptDiagnostic = (source: string, filePath: string): string | undefined => {
  try {
    const ast = babelParse(source);
    const loaders = loaderNames(ast);
    let diagnostic: string | undefined;
    traverse(ast, {
      ImportDeclaration(path) {
        if (isShimSource(path.node.source.value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
      },
      ExportNamedDeclaration(path) {
        if (path.node.source && isShimSource(path.node.source.value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
      },
      ExportAllDeclaration(path) {
        if (isShimSource(path.node.source.value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
      },
      TSImportEqualsDeclaration(path) {
        const reference = path.node.moduleReference;
        if (!t.isTSExternalModuleReference(reference)) return;
        if (isShimSource(reference.expression.value)) {
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
        }
      },
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee, { name: 'eval' })) {
          diagnostic ??= `${filePath}: contains unresolved code execution`;
          return;
        }
        const moduleDiagnostic = moduleLoadDiagnostic(
          path.node.callee,
          path.node.arguments,
          filePath,
          loaders
        );
        if (moduleDiagnostic?.includes('react-dom-shim')) diagnostic = moduleDiagnostic;
        else diagnostic ??= moduleDiagnostic;
      },
      OptionalCallExpression(path) {
        const moduleDiagnostic = moduleLoadDiagnostic(
          path.node.callee,
          path.node.arguments,
          filePath,
          loaders
        );
        if (moduleDiagnostic?.includes('react-dom-shim')) diagnostic = moduleDiagnostic;
        else diagnostic ??= moduleDiagnostic;
      },
      ImportExpression(path) {
        const value = staticString(path.node.source);
        if (value && isShimSource(value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
        else if (!value) diagnostic ??= `${filePath}: contains an unresolved module load`;
      },
      StringLiteral(path) {
        if (!CONFIG_FILE.test(filePath) && isShimSource(path.node.value)) {
          diagnostic ??= `${filePath}: contains a react-dom-shim reference that cannot be removed safely`;
        }
      },
      TemplateLiteral(path) {
        if (hasShimReference(path.node)) {
          diagnostic ??= `${filePath}: contains a react-dom-shim reference that cannot be removed safely`;
        }
      },
      BinaryExpression(path) {
        if (hasShimReference(path.node)) {
          diagnostic ??= `${filePath}: contains a react-dom-shim reference that cannot be removed safely`;
        }
      },
      ObjectProperty(path) {
        if (CONFIG_FILE.test(filePath) && path.node.computed) {
          diagnostic ??= `${filePath}: contains computed configuration that cannot be removed safely`;
        }
      },
    });
    return diagnostic;
  } catch {
    return `${filePath}: cannot parse source during workspace scan`;
  }
};

const componentDiagnostic = (source: string, filePath: string): string | undefined => {
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  if (source.includes('<script') && !scripts.length) {
    return `${filePath}: cannot parse source during workspace scan`;
  }
  for (const script of scripts) {
    const diagnostic = scriptDiagnostic(script[1], filePath);
    if (diagnostic) return diagnostic;
  }
  const template = source.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '');
  const expressions = template.matchAll(/\s(?:@[\w:-]+|v-on:[\w:-]+|on[\w-]+)=(['"])(.*?)\1/gi);
  for (const expression of expressions) {
    const diagnostic = scriptDiagnostic(expression[2], filePath);
    if (diagnostic) return diagnostic;
  }
  return template.trim()
    ? `${filePath}: cannot prove absence in component template during workspace scan`
    : undefined;
};

const scriptHasShimUse = (source: string): boolean => {
  try {
    const ast = babelParse(source);
    let hasShimUse = false;
    traverse(ast, {
      ImportDeclaration(path) {
        hasShimUse ||= isShimSource(path.node.source.value);
      },
      ExportNamedDeclaration(path) {
        hasShimUse ||= Boolean(path.node.source && isShimSource(path.node.source.value));
      },
      ExportAllDeclaration(path) {
        hasShimUse ||= isShimSource(path.node.source.value);
      },
      TSImportEqualsDeclaration(path) {
        const reference = path.node.moduleReference;
        hasShimUse ||=
          t.isTSExternalModuleReference(reference) && isShimSource(reference.expression.value);
      },
      CallExpression(path) {
        hasShimUse ||= path.node.arguments.some(
          (argument) => t.isExpression(argument) && hasShimReference(argument)
        );
      },
      OptionalCallExpression(path) {
        hasShimUse ||= path.node.arguments.some(
          (argument) => t.isExpression(argument) && hasShimReference(argument)
        );
      },
      ImportExpression(path) {
        hasShimUse ||= hasShimReference(path.node.source);
      },
    });
    return hasShimUse;
  } catch {
    return false;
  }
};

export const sourceHasShimUse = (source: string, filePath: string): boolean => {
  if (!COMPONENT_FILE.test(filePath)) return scriptHasShimUse(source);
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const template = source.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '');
  const expressions = template.matchAll(/\s(?:@[\w:-]+|v-on:[\w:-]+|on[\w-]+)=(['"])(.*?)\1/gi);
  return [
    ...scripts.map((script) => script[1]),
    ...[...expressions].map((expression) => expression[2]),
  ].some(scriptHasShimUse);
};

export const sourceDiagnostic = (source: string, filePath: string): string | undefined => {
  if (!COMPONENT_FILE.test(filePath)) return scriptDiagnostic(source, filePath);
  return componentDiagnostic(source, filePath);
};
