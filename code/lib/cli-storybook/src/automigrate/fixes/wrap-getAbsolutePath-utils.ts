import { types as t } from 'storybook/internal/babel';
import type { ConfigFile } from 'storybook/internal/csf-tools';

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
export function doesVariableOrFunctionDeclarationExist(node: t.Node, name: string) {
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
 * Wrap a value with getAbsolutePath wrapper.
 *
 * @example
 *
 * ```ts
 * // Before
 * {
 *   framework: '@storybook/react-vite';
 * }
 *
 * // After
 * {
 *   framework: getAbsolutePath('@storybook/react-vite');
 * }
 * ```
 */
function getReferenceToGetAbsolutePathWrapper(config: ConfigFile, value: string) {
  return t.callExpression(
    t.identifier(getAbsolutePathWrapperName(config) ?? PREFERRED_GET_ABSOLUTE_PATH_WRAPPER_NAME),
    [t.stringLiteral(value)]
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

/** Check if the node needs to be wrapped with getAbsolutePath wrapper. */
export function isGetAbsolutePathWrapperNecessary(
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
export function getFieldsForGetAbsolutePathWrapper(config: ConfigFile): t.Node[] {
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
 *
 * @example
 *
 * ```ts
 * function getAbsolutePath(value) {
 *   return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
 * }
 * ```
 */
export function getAbsolutePathWrapperAsCallExpression(
  isConfigTypescript: boolean
): t.FunctionDeclaration {
  const functionDeclaration = {
    ...t.functionDeclaration(
      t.identifier(PREFERRED_GET_ABSOLUTE_PATH_WRAPPER_NAME),
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
            t.callExpression(t.identifier('fileURLToPath'), [
              t.callExpression(
                t.memberExpression(
                  t.metaProperty(t.identifier('import'), t.identifier('meta')),
                  t.identifier('resolve')
                ),
                [
                  t.templateLiteral(
                    [
                      t.templateElement({ raw: '' }),
                      t.templateElement({ raw: '/package.json' }, true),
                    ],
                    [t.identifier('value')]
                  ),
                ]
              ),
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

export function wrapValueWithGetAbsolutePathWrapper(config: ConfigFile, node: t.Node) {
  isGetAbsolutePathWrapperNecessary(node, (n) => {
    if (t.isStringLiteral(n)) {
      const wrapperNode = getReferenceToGetAbsolutePathWrapper(config, n.value);
      Object.keys(n).forEach((k) => {
        delete n[k as keyof typeof n];
      });
      Object.keys(wrapperNode).forEach((k) => {
        (n as any)[k] = wrapperNode[k as keyof typeof wrapperNode];
      });
    }

    if (t.isObjectProperty(n) && t.isStringLiteral(n.value)) {
      n.value = getReferenceToGetAbsolutePathWrapper(config, n.value.value) as any;
    }

    if (t.isArrayExpression(n)) {
      n.elements.forEach((element) => {
        if (element && isGetAbsolutePathWrapperNecessary(element)) {
          wrapValueWithGetAbsolutePathWrapper(config, element);
        }
      });
    }
  });
}
