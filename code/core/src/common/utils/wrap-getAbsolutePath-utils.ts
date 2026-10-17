import type { ConfigFile } from 'storybook/internal/csf-tools';

import { type Node, isStringLiteral } from '../../csf-tools/estree/ast.ts';
import { prependStatement, printString } from '../../csf-tools/estree/editor.ts';

const PREFERRED_GET_ABSOLUTE_PATH_WRAPPER_NAME = 'getAbsolutePath';
const ALTERNATIVE_GET_ABSOLUTE_PATH_WRAPPER_NAME = 'wrapForPnp';

/**
 * Checks if the following node declarations exists in the main config file.
 *
 * @example
 *
 * ```ts
 * const <name> = () => {};
 * function <name>() {}
 * ```
 */
export function doesVariableOrFunctionDeclarationExist(node: Node, name: string) {
  return (
    (node.type === 'VariableDeclaration' &&
      node.declarations.length === 1 &&
      node.declarations[0].id.type === 'Identifier' &&
      node.declarations[0].id.name === name) ||
    (node.type === 'FunctionDeclaration' && node.id?.name === name)
  );
}

/**
 * Returns the name of the getAbsolutePath wrapper function if it exists in the main config file.
 *
 * @returns Name of the getAbsolutePath wrapper function (e.g. `getAbsolutePath`).
 */
export function getAbsolutePathWrapperName(config: ConfigFile) {
  const declarationName = config
    .getBodyDeclarations()
    .flatMap((node) =>
      doesVariableOrFunctionDeclarationExist(node, ALTERNATIVE_GET_ABSOLUTE_PATH_WRAPPER_NAME)
        ? [ALTERNATIVE_GET_ABSOLUTE_PATH_WRAPPER_NAME]
        : doesVariableOrFunctionDeclarationExist(node, PREFERRED_GET_ABSOLUTE_PATH_WRAPPER_NAME)
          ? [PREFERRED_GET_ABSOLUTE_PATH_WRAPPER_NAME]
          : []
    );

  if (declarationName.length) {
    return declarationName[0];
  }

  return null;
}

/** Source of a call to the config's getAbsolutePath wrapper, such as `getAbsolutePath('x')`. */
export function getAbsolutePathCall(config: ConfigFile, value: string) {
  const wrapper = getAbsolutePathWrapperName(config) ?? PREFERRED_GET_ABSOLUTE_PATH_WRAPPER_NAME;
  return `${wrapper}(${printString(value, config._quote)})`;
}

// Relative paths resolve from the config dir; the wrapper's `${value}/package.json` lookup breaks them.
function isRelativePathSpecifier(value: string) {
  return value.startsWith('.');
}

/** Check if the node needs to be wrapped with getAbsolutePath wrapper. */
export function isGetAbsolutePathWrapperNecessary(
  node: Node,
  cb: (node: Node) => void = () => {}
): boolean {
  if (isStringLiteral(node)) {
    if (isRelativePathSpecifier(node.value)) {
      return false;
    }
    cb(node);
    return true;
  }

  if (node.type === 'ObjectExpression') {
    const nameProperty = node.properties.find(
      (property) =>
        property.type === 'Property' &&
        property.key.type === 'Identifier' &&
        property.key.name === 'name'
    );

    if (
      nameProperty?.type === 'Property' &&
      isStringLiteral(nameProperty.value) &&
      !isRelativePathSpecifier(nameProperty.value.value)
    ) {
      cb(nameProperty.value);
      return true;
    }
  }

  if (
    node.type === 'ArrayExpression' &&
    node.elements.some((element) => element && isGetAbsolutePathWrapperNecessary(element))
  ) {
    cb(node);
    return true;
  }

  return false;
}

/**
 * Get all fields that need to be wrapped with getAbsolutePath wrapper.
 *
 * @returns Array of fields that need to be wrapped with getAbsolutePath wrapper.
 */
export function getFieldsForGetAbsolutePathWrapper(config: ConfigFile): Node[] {
  const frameworkNode = config.getFieldNode(['framework']);
  const builderNode = config.getFieldNode(['core', 'builder']);
  const rendererNode = config.getFieldNode(['core', 'renderer']);
  const addons = config.getFieldNode(['addons']);

  return [
    ...(frameworkNode ? [frameworkNode] : []),
    ...(builderNode ? [builderNode] : []),
    ...(rendererNode ? [rendererNode] : []),
    ...(addons?.type === 'ArrayExpression' ? [addons] : []),
  ];
}

/**
 * Returns the source of the following function, for `ConfigFile#setBodyDeclaration`.
 *
 * @example
 *
 * ```ts
 * function getAbsolutePath(value) {
 *   return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
 * }
 * ```
 */
export function getAbsolutePathWrapperDeclaration(
  isConfigTypescript: boolean,
  names = { dirname: 'dirname', fileURLToPath: 'fileURLToPath' }
): string {
  let parameter = 'value';
  while (Object.values(names).includes(parameter)) {
    parameter = `_${parameter}`;
  }
  return [
    '/**',
    ' * This function is used to resolve the absolute path of a package.',
    ' * It is needed in projects that are set up within a monorepo.',
    ' */',
    `function ${PREFERRED_GET_ABSOLUTE_PATH_WRAPPER_NAME}(${parameter}${isConfigTypescript ? ': string' : ''})${isConfigTypescript ? ': any' : ''} {`,
    `  return ${names.dirname}(${names.fileURLToPath}(import.meta.resolve(\`\${${parameter}}/package.json\`)));`,
    '}',
  ].join('\n');
}

export function wrapValuesWithGetAbsolutePathWrapper(config: ConfigFile, nodes: Node[]) {
  const wrap = (node: Node) =>
    isGetAbsolutePathWrapperNecessary(node, (target) => {
      if (isStringLiteral(target)) {
        config._editorSource.edits.overwrite(
          target.start,
          target.end,
          getAbsolutePathCall(config, target.value)
        );
      } else if (target.type === 'ArrayExpression') {
        target.elements.forEach((element) => element && wrap(element));
      }
    });
  nodes.forEach(wrap);
  config._commit();
}

/**
 * Import the named export `imported` from `source` into a main config, and return the local name to
 * call it by. Reuses an existing import, and renames the import when the config already declares a
 * binding with that name, such as its own `const dirname`.
 */
export function ensureNamedImport(config: ConfigFile, imported: string, source: string) {
  const sameSource = (value: string) =>
    value.replace(/^node:/, '') === source.replace(/^node:/, '');
  for (const node of config._program.body) {
    if (node.type === 'ImportDeclaration' && sameSource(node.source.value)) {
      const existing = node.specifiers.find(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          (specifier.imported.type === 'Identifier'
            ? specifier.imported.name
            : specifier.imported.value) === imported
      );
      if (existing) {
        return existing.local.name;
      }
    }
  }

  const taken = config._editorSource.scopes.program.bindings;
  if (!taken.has(imported)) {
    config.setImport([imported], source);
    return imported;
  }

  let local = `${source.replace(/^node:/, '')}${imported[0].toUpperCase()}${imported.slice(1)}`;
  while (taken.has(local)) {
    local = `_${local}`;
  }
  prependStatement(
    config._editorSource,
    `import { ${imported} as ${local} } from ${printString(source, config._quote)};`
  );
  config._commit();
  return local;
}
