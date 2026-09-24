import { babelParse, traverse, types as t } from 'storybook/internal/babel';

import { hasShimReference, isShimSource, staticString } from './react-dom-shim.ts';

const CONFIG_FILE = /(^|[/\\])(?:main|vite(?:st)?\.config)\.[cm]?[jt]sx?$/;
const COMPONENT_FILE = /\.(?:svelte|vue)$/;

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
  staticString(node.arguments[0]) === 'node:module';

const loaderNames = (program: t.Program): Set<string> => {
  const loaders = new Set(['require']);
  const factories = new Set<string>();
  for (const statement of program.body) {
    if (t.isImportDeclaration(statement) && statement.source.value === 'node:module') {
      for (const specifier of statement.specifiers) {
        if (t.isImportSpecifier(specifier) && specifier.imported.name === 'createRequire') {
          factories.add(specifier.local.name);
        }
      }
    }
    if (!t.isVariableDeclaration(statement)) continue;
    for (const declaration of statement.declarations) {
      if (t.isObjectPattern(declaration.id) && isModuleFactory(declaration.init, loaders)) {
        for (const property of declaration.id.properties) {
          if (
            t.isObjectProperty(property) &&
            t.isIdentifier(property.key, { name: 'createRequire' }) &&
            t.isIdentifier(property.value)
          ) {
            factories.add(property.value.name);
          }
        }
        continue;
      }
      if (!t.isIdentifier(declaration.id)) continue;
      if (t.isIdentifier(declaration.init) && loaders.has(declaration.init.name)) {
        loaders.add(declaration.id.name);
      } else if (
        t.isMemberExpression(declaration.init) &&
        t.isIdentifier(declaration.init.object, { name: 'module' }) &&
        t.isIdentifier(declaration.init.property, { name: 'require' })
      ) {
        loaders.add(declaration.id.name);
      } else if (t.isIdentifier(declaration.init) && factories.has(declaration.init.name)) {
        factories.add(declaration.id.name);
      } else if (
        t.isCallExpression(declaration.init) &&
        t.isIdentifier(declaration.init.callee) &&
        factories.has(declaration.init.callee.name)
      ) {
        loaders.add(declaration.id.name);
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
    const loaders = loaderNames(ast.program);
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

export const sourceDiagnostic = (source: string, filePath: string): string | undefined => {
  if (!COMPONENT_FILE.test(filePath)) return scriptDiagnostic(source, filePath);
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  if (source.includes('<script') && !scripts.length) {
    return `${filePath}: cannot parse source during workspace scan`;
  }
  return scripts
    .map((script) => scriptDiagnostic(script[1], filePath))
    .find((diagnostic) => diagnostic !== undefined);
};
