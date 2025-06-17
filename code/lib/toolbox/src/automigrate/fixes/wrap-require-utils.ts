import * as t from '@babel/types';
import type { ConfigFile } from '@storybook/core/csf-tools';

const defaultRequireWrapperName = 'getAbsolutePath';

/**
 * Checks if the following node declarations exists in the main config file.
 * @example
 * const <name> = () => {};
 * function <name>() {}
 */
function doesVariableOrFunctionDeclarationExist(node: t.Node, name: string) {
  return (
    (t.isVariableDeclaration(node) &&
      node.declarations.length === 1 &&
      t.isVariableDeclarator(node.declarations[0]) &&
      t.isIdentifier(node.declarations[0].id) &&
      node.declarations[0].id?.name === name) ||
    (t.isFunctionDeclaration(node) && t.isIdentifier(node.id) && node.id.name === name)
  );
}

/**
 * Wrap a value with require wrapper.
 * @example
 * // Before
 * { framework: 'react' }
 *
 * // After
 * { framework: wrapForPnp('react') }
 */
function getReferenceToRequireWrapper(config: ConfigFile, value: string) {
  return t.callExpression(
    t.identifier(getRequireWrapperName(config) ?? defaultRequireWrapperName),
    [t.stringLiteral(value)]
  );
}

/**
 * Returns the name of the require wrapper function if it exists in the main config file.
 * @returns Name of the require wrapper function.
 */
export function getRequireWrapperName(config: ConfigFile) {
  const declarationName = config
    .getBodyDeclarations()
    .flatMap((node) =>
      doesVariableOrFunctionDeclarationExist(node, 'wrapForPnp')
        ? ['wrapForPnp']
        : doesVariableOrFunctionDeclarationExist(node, defaultRequireWrapperName)
          ? [defaultRequireWrapperName]
          : []
    );

  if (declarationName.length) {
    return declarationName[0];
  }

  return null;
}

/**
 * Check if the node needs to be wrapped with require wrapper.
 */
export function isRequireWrapperNecessary(
  node: t.Node,
  cb: (node: t.StringLiteral | t.ObjectProperty | t.ArrayExpression) => void = () => {}
) {
  if (t.isStringLiteral(node)) {
    // value will be converted from StringLiteral to CallExpression.
    cb(node);
    return true;
  }

  if (t.isObjectExpression(node)) {
    const nameProperty = node.properties.find(
      (property) =>
        t.isObjectProperty(property) && t.isIdentifier(property.key) && property.key.name === 'name'
    ) as t.ObjectProperty;

    if (nameProperty && t.isStringLiteral(nameProperty.value)) {
      cb(nameProperty);
      return true;
    }
  }

  if (
    t.isArrayExpression(node) &&
    node.elements.some((element) => element && isRequireWrapperNecessary(element))
  ) {
    cb(node);
    return true;
  }

  return false;
}

/**
 * Get all fields that need to be wrapped with require wrapper.
 * @returns Array of fields that need to be wrapped with require wrapper.
 */
export function getFieldsForRequireWrapper(config: ConfigFile): t.Node[] {
  const frameworkNode = config.getFieldNode(['framework']);
  const builderNode = config.getFieldNode(['core', 'builder']);
  const rendererNode = config.getFieldNode(['core', 'renderer']);
  const addons = config.getFieldNode(['addons']);

  const fieldsWithRequireWrapper = [
    ...(frameworkNode ? [frameworkNode] : []),
    ...(builderNode ? [builderNode] : []),
    ...(rendererNode ? [rendererNode] : []),
    ...(addons && t.isArrayExpression(addons) ? [addons] : []),
  ];

  return fieldsWithRequireWrapper;
}

/**
 * Returns AST for the following function
 * @example
 * function getAbsolutePath(value) {
 *  return dirname(require.resolve(join(value, 'package.json')))
 * }
 */
export function getRequireWrapperAsCallExpression(
  isConfigTypescript: boolean
): t.FunctionDeclaration {
  const functionDeclaration = {
    ...t.functionDeclaration(
      t.identifier(defaultRequireWrapperName),
      [
        {
          ...t.identifier('value'),
          ...(isConfigTypescript
            ? { typeAnnotation: t.tsTypeAnnotation(t.tSStringKeyword()) }
            : {}),
        },
      ],
      t.blockStatement([
        t.returnStatement(
          t.callExpression(t.identifier('dirname'), [
            t.callExpression(t.memberExpression(t.identifier('require'), t.identifier('resolve')), [
              t.callExpression(t.identifier('join'), [
                t.identifier('value'),
                t.stringLiteral('package.json'),
              ]),
            ]),
          ])
        ),
      ])
    ),
    ...(isConfigTypescript ? { returnType: t.tSTypeAnnotation(t.tsAnyKeyword()) } : {}),
  };

  t.addComment(
    functionDeclaration,
    'leading',
    '*\n * This function is used to resolve the absolute path of a package.\n * It is needed in projects that use Yarn PnP or are set up within a monorepo.\n'
  );

  return functionDeclaration;
}

export function wrapValueWithRequireWrapper(config: ConfigFile, node: t.Node) {
  isRequireWrapperNecessary(node, (n) => {
    if (t.isStringLiteral(n)) {
      const wrapperNode = getReferenceToRequireWrapper(config, n.value);
      Object.keys(n).forEach((k) => {
        delete n[k as keyof typeof n];
      });
      Object.keys(wrapperNode).forEach((k) => {
        (n as any)[k] = wrapperNode[k as keyof typeof wrapperNode];
      });
    }

    if (t.isObjectProperty(n) && t.isStringLiteral(n.value)) {
      n.value = getReferenceToRequireWrapper(config, n.value.value) as any;
    }

    if (t.isArrayExpression(n)) {
      n.elements.forEach((element, index, elements) => {
        if (t.isStringLiteral(element)) {
          elements[index] = getReferenceToRequireWrapper(config, element.value);
        }
      });
    }
  });
}
