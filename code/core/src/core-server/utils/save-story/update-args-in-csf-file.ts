import { types as t, traverse } from 'storybook/internal/babel';

import { SaveStoryError } from './utils.ts';
import { valueToAST } from './valueToAST.ts';

// Non-identifier keys like 'data-testid' must be quoted or the generated code is invalid syntax.
const argKey = (key: string) =>
  t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key);

const argKeyName = (key: t.ObjectProperty['key']): string | null => {
  if (t.isIdentifier(key)) {
    return key.name;
  }
  if (t.isStringLiteral(key)) {
    return key.value;
  }
  if (t.isNumericLiteral(key)) {
    return String(key.value);
  }
  return null;
};

export const updateArgsInCsfFile = async (node: t.Node, input: Record<string, any>) => {
  let found = false;
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

  if (t.isObjectExpression(node)) {
    const properties = node.properties;
    const argsProperty = properties.find((property) => {
      if (t.isObjectProperty(property)) {
        const key = property.key;
        return t.isIdentifier(key) && key.name === 'args';
      }
      return false;
    });

    if (argsProperty) {
      if (t.isObjectProperty(argsProperty)) {
        const a = argsProperty.value;
        if (t.isObjectExpression(a)) {
          a.properties.forEach((p) => {
            if (t.isObjectProperty(p)) {
              const keyName = argKeyName(p.key);
              if (keyName !== null && keyName in args) {
                p.value = args[keyName];
                delete args[keyName];
              }
            }
          });

          const remainder = Object.entries(args);
          if (Object.keys(args).length) {
            remainder.forEach(([key, value]) => {
              a.properties.push(t.objectProperty(argKey(key), value));
            });
          }
        }
      }
    } else {
      properties.unshift(
        t.objectProperty(
          t.identifier('args'),
          t.objectExpression(
            Object.entries(args).map(([key, value]) => t.objectProperty(argKey(key), value))
          )
        )
      );
    }
    return;
  }

  traverse(node, {
    ObjectExpression(path) {
      if (found) {
        return;
      }

      found = true;
      const properties = path.get('properties');
      const argsProperty = properties.find((property) => {
        if (property.isObjectProperty()) {
          const key = property.get('key');
          return key.isIdentifier() && key.node.name === 'args';
        }
        return false;
      });

      if (argsProperty) {
        if (argsProperty.isObjectProperty()) {
          const a = argsProperty.get('value');
          if (a.isObjectExpression()) {
            // only direct properties, so nested keys cannot consume args meant for the top level
            a.get('properties').forEach((p) => {
              if (p.isObjectProperty()) {
                const keyName = argKeyName(p.node.key);
                if (keyName !== null && keyName in args) {
                  p.get('value').replaceWith(args[keyName]);
                  delete args[keyName];
                }
              }
            });

            const remainder = Object.entries(args);
            if (Object.keys(args).length) {
              remainder.forEach(([key, value]) => {
                a.pushContainer('properties', t.objectProperty(argKey(key), value));
              });
            }
          }
        }
      } else {
        path.unshiftContainer(
          'properties',
          t.objectProperty(
            t.identifier('args'),
            t.objectExpression(
              Object.entries(args).map(([key, value]) => t.objectProperty(argKey(key), value))
            )
          )
        );
      }
    },

    noScope: true,
  });
};
