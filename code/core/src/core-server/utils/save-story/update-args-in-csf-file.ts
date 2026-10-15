import { types as t } from 'storybook/internal/babel';
import { isCsfFactoryCall, keyOf, unwrapExpression } from 'storybook/internal/csf-tools';

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
  const argsIndex = properties.findIndex(
    (property) => t.isObjectProperty(property) && keyOf(property) === 'args'
  );
  const argsProperty = properties[argsIndex];
  const argsObject = t.isObjectProperty(argsProperty) ? argsProperty.value : t.objectExpression([]);
  if (!t.isObjectExpression(argsObject)) {
    return;
  }

  if (argsIndex < lastSpreadIndex) {
    if (
      properties.some((property) => {
        if (!t.isSpreadElement(property)) {
          return false;
        }
        const skippedNodes = new Set<t.Node>();
        return t.traverseFast(property.argument, (node) => {
          if (skippedNodes.has(node)) {
            return t.traverseFast.skip;
          }
          if (t.isCallExpression(node) || t.isOptionalCallExpression(node)) {
            return t.traverseFast.stop;
          }
          if (t.isFunction(node) && !(t.isObjectMethod(node) && node.kind === 'get')) {
            skippedNodes.add(node.body);
            node.params.forEach((param) => skippedNodes.add(param));
          }
        });
      })
    ) {
      throw new SaveStoryError(
        'Saving args for stories with function-call spreads is not supported'
      );
    }

    const existingArgs = argsObject.properties.filter((property) => {
      const key = t.isObjectProperty(property) ? keyOf(property) : null;
      return key === null || !Object.hasOwn(args, key);
    });
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
    if (!t.isObjectProperty(property)) {
      return;
    }
    const key = keyOf(property);
    if (key !== null && Object.hasOwn(args, key)) {
      property.value = args[key];
      delete args[key];
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
