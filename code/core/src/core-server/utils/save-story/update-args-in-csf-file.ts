import { types as t } from 'storybook/internal/babel';
import { isCsfFactoryCall, unwrapExpression } from 'storybook/internal/csf-tools';

import { SaveStoryError } from './utils.ts';
import { valueToAST } from './valueToAST.ts';

export const updateArgsInCsfFile = async (node: t.Node, input: Record<string, any>) => {
  const args = Object.fromEntries(
    Object.entries(input).map(([k, v]) => {
      if (!t.isValidIdentifier(k, false)) {
        throw new SaveStoryError(`Invalid arg name: ${JSON.stringify(k)}`);
      }
      return [k, valueToAST(v)];
    })
  );

  const story = unwrapExpression(t.isVariableDeclarator(node) && node.init ? node.init : node);
  const isCsf4Story = isCsfFactoryCall(story);

  if (!isCsf4Story && (t.isArrowFunctionExpression(story) || t.isCallExpression(story))) {
    throw new SaveStoryError(`Updating a CSF2 story is not supported`);
  }

  const object = isCsf4Story ? story.arguments[0] && unwrapExpression(story.arguments[0]) : story;
  if (!t.isObjectExpression(object)) {
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
    if (
      properties.some((property) => {
        if (!t.isSpreadElement(property)) {
          return false;
        }
        return t.traverseFast(property.argument, (node) => {
          if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
            return t.traverseFast.stop;
          }
        });
      })
    ) {
      throw new SaveStoryError(
        'Saving args for stories with function-call spreads is not supported'
      );
    }

    const existingArgs = argsObject.properties.filter(
      (property) =>
        !(t.isObjectProperty(property) && t.isIdentifier(property.key) && property.key.name in args)
    );
    argsObject.properties = properties.slice(0, lastSpreadIndex + 1).flatMap((property) => {
      if (t.isSpreadElement(property)) {
        return [
          t.spreadElement(
            t.optionalMemberExpression(
              t.cloneNode(property.argument),
              t.identifier('args'),
              false,
              true
            )
          ),
        ];
      }
      return property === argsProperty ? existingArgs : [];
    });
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
