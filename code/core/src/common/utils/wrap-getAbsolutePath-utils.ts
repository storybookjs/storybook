import type { ConfigFile } from 'storybook/internal/csf-tools';

import { type Node, isStringLiteral } from '../../csf-tools/estree/ast.ts';
import { printString } from '../../csf-tools/estree/editor.ts';

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

/**
 * Source of a call to the getAbsolutePath wrapper.
 *
 * @example
 *
 * ```ts
 * getAbsolutePathCall(config, '@storybook/react-vite'); // "getAbsolutePath('@storybook/react-vite')"
 * ```
 */
export function getAbsolutePathCall(config: ConfigFile, value: string) {
  const wrapper = getAbsolutePathWrapperName(config) ?? PREFERRED_GET_ABSOLUTE_PATH_WRAPPER_NAME;
  return `${wrapper}(${printString(value, config._quote)})`;
}

/** Check if the node needs to be wrapped with getAbsolutePath wrapper. */
export function isGetAbsolutePathWrapperNecessary(
  node: Node,
  cb: (node: Node) => void = () => {}
): boolean {
  if (isStringLiteral(node)) {
    // value will be converted from a string literal to a call expression.
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

    if (nameProperty?.type === 'Property' && isStringLiteral(nameProperty.value)) {
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
export function getAbsolutePathWrapperDeclaration(isConfigTypescript: boolean): string {
  return [
    '/**',
    ' * This function is used to resolve the absolute path of a package.',
    ' * It is needed in projects that are set up within a monorepo.',
    ' */',
    `function ${PREFERRED_GET_ABSOLUTE_PATH_WRAPPER_NAME}(value${isConfigTypescript ? ': string' : ''})${isConfigTypescript ? ': any' : ''} {`,
    '  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));',
    '}',
  ].join('\n');
}

/** Wrap every string value in the given config nodes with the getAbsolutePath wrapper. */
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
