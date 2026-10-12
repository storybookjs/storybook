import { types as t, traverse } from 'storybook/internal/babel';

import { SaveStoryError } from './utils.ts';
import { valueToAST } from './valueToAST.ts';

export const updateArgsInCsfFile = async (node: t.Node, input: Record<string, any>) => {
  const args = Object.fromEntries(
    Object.entries(input).map(([k, v]) => {
      return [k, valueToAST(v)];
    })
  );

  const isCsf4Story =
    t.isCallExpression(node) &&
    t.isMemberExpression(node.callee) &&
    t.isIdentifier(node.callee.property) &&
    node.callee.property.name === 'story';

  // detect CSF2 and throw
  if (!isCsf4Story && (t.isArrowFunctionExpression(node) || t.isCallExpression(node))) {
    throw new SaveStoryError(`Updating a CSF2 story is not supported`);
  }

  let object = t.isObjectExpression(node) ? node : undefined;
  if (!object) {
    traverse(node, {
      ObjectExpression(path) {
        object = path.node;
        path.stop();
      },
      noScope: true,
    });
  }
  if (!object) {
    return;
  }

  const properties = object.properties;
  const lastSpreadIndex = properties.findLastIndex((property) => t.isSpreadElement(property));
  const argsProperty = properties.find(
    (property): property is t.ObjectProperty =>
      t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'args' })
  );
  if (argsProperty && !t.isObjectExpression(argsProperty.value)) {
    return;
  }

  const argsIndex = argsProperty ? properties.indexOf(argsProperty) : -1;
  const argsObject =
    argsProperty && t.isObjectExpression(argsProperty.value)
      ? argsProperty.value
      : t.objectExpression([]);

  if (argsIndex < lastSpreadIndex) {
    const inherited = t.objectExpression([
      t.spreadElement(
        t.objectExpression([t.objectProperty(t.identifier('args'), t.cloneNode(argsObject))])
      ),
      ...properties
        .slice(argsIndex + 1, lastSpreadIndex + 1)
        .filter((property) => t.isSpreadElement(property))
        .map((property) => t.cloneNode(property)),
    ]);
    argsObject.properties = [
      t.spreadElement(
        t.logicalExpression(
          '??',
          t.memberExpression(inherited, t.identifier('args')),
          t.objectExpression([])
        )
      ),
    ];
  }

  argsObject.properties.forEach((property) => {
    if (t.isObjectProperty(property) && t.isIdentifier(property.key) && property.key.name in args) {
      property.value = args[property.key.name];
      delete args[property.key.name];
    }
  });
  Object.entries(args).forEach(([key, value]) => {
    argsObject.properties.push(t.objectProperty(t.identifier(key), value));
  });

  if (!argsProperty) {
    properties.splice(lastSpreadIndex + 1, 0, t.objectProperty(t.identifier('args'), argsObject));
  } else if (argsIndex < lastSpreadIndex) {
    properties.splice(argsIndex, 1);
    properties.splice(lastSpreadIndex, 0, argsProperty);
  }
};
