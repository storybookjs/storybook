import { babelParse, traverse, types as t } from 'storybook/internal/babel';
import { capabilityCallEscapes } from './react-dom-shim-capability.ts';
import { loaderReferenceEscapes, memberPropertyName } from './react-dom-shim-loader-reference.ts';
import { hasShimReference, isShimSource, staticString } from './react-dom-shim.ts';

const CONFIG_FILE = /(^|[/\\])(?:main|vite(?:st)?\.config)\.[cm]?[jt]sx?$/;
const COMPONENT_FILE = /\.(?:svelte|vue)$/;
const MODULE_BUILTIN = new Set(['module', 'node:module']);
const moduleLoad = (
  callee: t.CallExpression['callee'] | t.OptionalCallExpression['callee'],
  loaders: Set<string>,
  modules: Set<string>
): 'known' | 'unresolved' | undefined => {
  if (t.isImport(callee) || (t.isIdentifier(callee) && loaders.has(callee.name))) return 'known';
  if (!t.isMemberExpression(callee) && !t.isOptionalMemberExpression(callee)) {
    return undefined;
  }
  const knownLoader =
    t.isIdentifier(callee.object) &&
    (loaders.has(callee.object.name) ||
      callee.object.name === 'module' ||
      modules.has(callee.object.name));
  if (!knownLoader) return undefined;
  const property = callee.computed
    ? staticString(callee.property)
    : t.isIdentifier(callee.property)
      ? callee.property.name
      : undefined;
  return property === 'resolve' || property === 'require' ? 'known' : 'unresolved';
};
const isModuleObject = (
  node: t.Node | null | undefined,
  loaders: Set<string>,
  modules: Set<string>
) =>
  (t.isIdentifier(node) && (node.name === 'module' || modules.has(node.name))) ||
  ((t.isCallExpression(node) || t.isOptionalCallExpression(node)) &&
    t.isIdentifier(node.callee) &&
    loaders.has(node.callee.name) &&
    MODULE_BUILTIN.has(staticString(node.arguments[0]) ?? ''));
const isCreateRequireFactory = (
  node: t.Node | null | undefined,
  loaders: Set<string>,
  factories: Set<string>,
  modules: Set<string>
) =>
  (t.isIdentifier(node) && factories.has(node.name)) ||
  ((t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
    isModuleObject(node.object, loaders, modules) &&
    memberPropertyName(node) === 'createRequire');
const isLoader = (
  node: t.Node | null | undefined,
  loaders: Set<string>,
  factories: Set<string>,
  modules: Set<string>
) =>
  (t.isIdentifier(node) && loaders.has(node.name)) ||
  ((t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
    t.isIdentifier(node.object) &&
    (loaders.has(node.object.name) || isModuleObject(node.object, loaders, modules)) &&
    ['require', 'resolve'].includes(memberPropertyName(node) ?? '')) ||
  ((t.isCallExpression(node) || t.isOptionalCallExpression(node)) &&
    isCreateRequireFactory(node.callee, loaders, factories, modules));
const addLoaderProperties = (
  pattern: t.ObjectPattern,
  source: t.Node | null | undefined,
  loaders: Set<string>,
  factories: Set<string>,
  modules: Set<string>,
  add: (names: Set<string>, name: string) => void
): boolean => {
  if (!isLoader(source, loaders, factories, modules)) return false;
  return pattern.properties.some((property) => {
    if (!t.isObjectProperty(property) || property.computed || !t.isIdentifier(property.value)) {
      return true;
    }
    const name = t.isIdentifier(property.key) ? property.key.name : staticString(property.key);
    if (name === undefined || !['require', 'resolve'].includes(name)) return true;
    add(loaders, property.value.name);
    return false;
  });
};
const addFactoryProperties = (
  pattern: t.ObjectPattern,
  source: t.Node | null | undefined,
  loaders: Set<string>,
  factories: Set<string>,
  modules: Set<string>,
  add: (names: Set<string>, name: string) => void
) => {
  if (!isModuleObject(source, loaders, modules)) return false;
  return pattern.properties.some((property) => {
    const name =
      t.isObjectProperty(property) &&
      (property.computed
        ? staticString(property.key)
        : t.isIdentifier(property.key)
          ? property.key.name
          : staticString(property.key));
    if (
      !t.isObjectProperty(property) ||
      name !== 'createRequire' ||
      !t.isIdentifier(property.value)
    ) {
      return true;
    }
    add(factories, property.value.name);
    return false;
  });
};

type LoaderCapabilities = {
  factories: Set<string>;
  loaders: Set<string>;
  modules: Set<string>;
};

const collectDeclarations = (file: t.File) => {
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
  return { assignments, declarations };
};

const collectImportedCapabilities = (program: t.Program, capabilities: LoaderCapabilities) => {
  for (const statement of program.body) {
    if (t.isTSImportEqualsDeclaration(statement)) {
      const reference = statement.moduleReference;
      if (
        t.isTSExternalModuleReference(reference) &&
        MODULE_BUILTIN.has(reference.expression.value)
      ) {
        capabilities.modules.add(statement.id.name);
      }
    }
    if (!t.isImportDeclaration(statement) || !MODULE_BUILTIN.has(statement.source.value)) continue;
    for (const specifier of statement.specifiers) {
      const importedName =
        t.isImportSpecifier(specifier) &&
        (t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value);
      if (importedName === 'createRequire') capabilities.factories.add(specifier.local.name);
      if (t.isImportNamespaceSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)) {
        capabilities.modules.add(specifier.local.name);
      }
    }
  }
};

const propagatePattern = (
  pattern: t.ObjectPattern,
  source: t.Node | null | undefined,
  capabilities: LoaderCapabilities,
  add: (names: Set<string>, name: string) => void
) => {
  const { factories, loaders, modules } = capabilities;
  const unresolvedFactory = addFactoryProperties(pattern, source, loaders, factories, modules, add);
  if (unresolvedFactory || isModuleObject(source, loaders, modules)) return unresolvedFactory;
  return addLoaderProperties(pattern, source, loaders, factories, modules, add);
};

const propagateIdentifier = (
  name: string,
  source: t.Node | null | undefined,
  capabilities: LoaderCapabilities,
  add: (names: Set<string>, name: string) => void
) => {
  const { factories, loaders, modules } = capabilities;
  if (isModuleObject(source, loaders, modules)) add(modules, name);
  else if (isLoader(source, loaders, factories, modules)) add(loaders, name);
  else if (isCreateRequireFactory(source, loaders, factories, modules)) add(factories, name);
};

const loaderNames = (file: t.File) => {
  const { program } = file;
  const capabilities: LoaderCapabilities = {
    loaders: new Set(['require']),
    factories: new Set<string>(),
    modules: new Set<string>(),
  };
  const { assignments, declarations } = collectDeclarations(file);
  collectImportedCapabilities(program, capabilities);
  let unresolved = false;
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
      if (t.isObjectPattern(declaration.id)) {
        unresolved ||= propagatePattern(declaration.id, declaration.init, capabilities, add);
        continue;
      }
      if (!t.isIdentifier(declaration.id)) continue;
      propagateIdentifier(declaration.id.name, declaration.init, capabilities, add);
    }
    for (const assignment of assignments) {
      if (t.isObjectPattern(assignment.left)) {
        unresolved ||= propagatePattern(assignment.left, assignment.right, capabilities, add);
        continue;
      }
      if (!t.isIdentifier(assignment.left)) continue;
      propagateIdentifier(assignment.left.name, assignment.right, capabilities, add);
    }
  }
  return { ...capabilities, unresolved };
};
const moduleLoadDiagnostic = (
  callee: t.CallExpression['callee'] | t.OptionalCallExpression['callee'],
  arguments_: (t.Expression | t.SpreadElement | t.JSXNamespacedName | t.ArgumentPlaceholder)[],
  filePath: string,
  loaders: Set<string>,
  modules: Set<string>
): string | undefined => {
  const [argument] = arguments_;
  const value = staticString(argument);
  if (value && isShimSource(value)) {
    return `${filePath}: contains a react-dom-shim import, re-export, or module load`;
  }
  if (value && MODULE_BUILTIN.has(value) && t.isImport(callee)) {
    return `${filePath}: contains an unresolved module load`;
  }
  const kind = moduleLoad(callee, loaders, modules);
  if (!kind) return undefined;
  return kind !== 'known' || !value ? `${filePath}: contains an unresolved module load` : undefined;
};

const scriptDiagnostic = (source: string, filePath: string): string | undefined => {
  try {
    const ast = babelParse(source);
    const { factories, loaders, modules, unresolved } = loaderNames(ast);
    let diagnostic: string | undefined;
    if (unresolved) diagnostic = `${filePath}: contains an unresolved module load`;
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
      ReferencedIdentifier(path) {
        if (loaderReferenceEscapes(path, loaders, factories, modules)) {
          diagnostic ??= `${filePath}: contains an unresolved module load`;
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
          loaders,
          modules
        );
        if (moduleDiagnostic?.includes('react-dom-shim')) diagnostic = moduleDiagnostic;
        else diagnostic ??= moduleDiagnostic;
        if (
          capabilityCallEscapes(
            path,
            isCreateRequireFactory(path.node.callee, loaders, factories, modules),
            false
          ) ||
          capabilityCallEscapes(path, isModuleObject(path.node, loaders, modules), true)
        ) {
          diagnostic ??= `${filePath}: contains an unresolved module load`;
        }
      },
      OptionalCallExpression(path) {
        const moduleDiagnostic = moduleLoadDiagnostic(
          path.node.callee,
          path.node.arguments,
          filePath,
          loaders,
          modules
        );
        if (moduleDiagnostic?.includes('react-dom-shim')) diagnostic = moduleDiagnostic;
        else diagnostic ??= moduleDiagnostic;
        if (
          capabilityCallEscapes(
            path,
            isCreateRequireFactory(path.node.callee, loaders, factories, modules),
            false
          ) ||
          capabilityCallEscapes(path, isModuleObject(path.node, loaders, modules), true)
        ) {
          diagnostic ??= `${filePath}: contains an unresolved module load`;
        }
      },
      ImportExpression(path) {
        const value = staticString(path.node.source);
        if (value && isShimSource(value))
          diagnostic = `${filePath}: contains a react-dom-shim import, re-export, or module load`;
        else if (!value || MODULE_BUILTIN.has(value))
          diagnostic ??= `${filePath}: contains an unresolved module load`;
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
