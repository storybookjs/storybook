import { generate, types as t } from 'storybook/internal/babel';
import { isCsfFactoryCall, keyOf, unwrapExpression } from 'storybook/internal/csf-tools';

import { SaveStoryError } from './utils.ts';
import { valueToAST } from './valueToAST.ts';

const isCopySafeSpread = (node: t.Node): boolean => {
  const expression = unwrapExpression(node);
  if (
    t.isIdentifier(expression) ||
    (t.isLiteral(expression) && !t.isTemplateLiteral(expression)) ||
    t.isArrowFunctionExpression(expression) ||
    t.isFunctionExpression(expression)
  ) {
    return true;
  }
  if (t.isMemberExpression(expression) || t.isOptionalMemberExpression(expression)) {
    return !expression.computed && isCopySafeSpread(expression.object);
  }
  if (t.isObjectExpression(expression)) {
    return expression.properties.every((property) => {
      if (t.isSpreadElement(property)) {
        return isCopySafeSpread(property.argument);
      }
      if (
        property.computed &&
        !t.isStringLiteral(property.key) &&
        !t.isNumericLiteral(property.key)
      ) {
        return false;
      }
      return t.isObjectMethod(property)
        ? property.kind !== 'get'
        : isCopySafeSpread(property.value);
    });
  }
  if (t.isArrayExpression(expression)) {
    return expression.elements.every(
      (element) => !element || (!t.isSpreadElement(element) && isCopySafeSpread(element))
    );
  }
  return false;
};

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
    const spreads = properties
      .slice(argsIndex + 1)
      .filter((property) => t.isSpreadElement(property));
    const unsafeSpread = spreads.find((property) => !isCopySafeSpread(property.argument));
    if (unsafeSpread) {
      throw new SaveStoryError(
        `Cannot save args: the spread \`${generate(unsafeSpread).code}\` cannot be copied safely. Add an \`args\` property after it, or edit args manually.`
      );
    }

    const existingArgs = argsObject.properties.filter((property) => {
      const key = t.isObjectProperty(property) ? keyOf(property) : null;
      return key === null || !Object.hasOwn(args, key);
    });
    argsObject.properties = [
      ...existingArgs,
      ...spreads.map((property) =>
        t.spreadElement(
          t.optionalMemberExpression(
            t.cloneNode(property.argument),
            t.identifier('args'),
            false,
            true
          )
        )
      ),
    ];
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
