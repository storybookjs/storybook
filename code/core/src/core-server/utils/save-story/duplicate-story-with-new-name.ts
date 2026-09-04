import { types as t, traverse } from 'storybook/internal/babel';
import type { CsfFile } from 'storybook/internal/csf-tools';

import { SaveStoryError } from './utils.ts';

type In = ReturnType<CsfFile['parse']>;

const getStoryObjectExpression = (
  init: t.VariableDeclarator['init'],
  isCsf4Story: boolean
): t.ObjectExpression | undefined => {
  if (isCsf4Story && t.isCallExpression(init) && t.isObjectExpression(init.arguments[0])) {
    return init.arguments[0];
  }

  let node = init;
  while (t.isTSSatisfiesExpression(node) || t.isTSAsExpression(node)) {
    node = node.expression;
  }

  return t.isObjectExpression(node) ? node : undefined;
};

export const duplicateStoryWithNewName = (csfFile: In, storyName: string, newStoryName: string) => {
  const node = csfFile._storyExports[storyName];
  const cloned = t.cloneNode(node) as t.VariableDeclarator;

  if (!cloned) {
    throw new SaveStoryError(`cannot clone Node`);
  }

  let found = false;
  traverse(cloned, {
    Identifier(path) {
      if (found) {
        return;
      }

      if (path.node.name === storyName) {
        found = true;
        path.node.name = newStoryName;
      }
    },
    ObjectProperty(path) {
      const key = path.get('key');
      if (key.isIdentifier() && key.node.name === 'args') {
        path.remove();
      }
    },

    noScope: true,
  });

  const isCsf4Story =
    t.isCallExpression(cloned.init) &&
    t.isMemberExpression(cloned.init.callee) &&
    t.isIdentifier(cloned.init.callee.property) &&
    cloned.init.callee.property.name === 'story';

  // detect CSF2 and throw
  if (
    !isCsf4Story &&
    (t.isArrowFunctionExpression(cloned.init) || t.isCallExpression(cloned.init))
  ) {
    throw new SaveStoryError(`Creating a new story based on a CSF2 story is not supported`);
  }

  // Remove the story's own `name` so the duplicate doesn't inherit the original's
  // display name. Nested `name` keys (parameters, argTypes) must be left untouched.
  const storyObject = getStoryObjectExpression(cloned.init, isCsf4Story);
  if (storyObject) {
    storyObject.properties = storyObject.properties.filter(
      (prop) =>
        !(
          t.isObjectProperty(prop) &&
          ((t.isIdentifier(prop.key) && !prop.computed && prop.key.name === 'name') ||
            (t.isStringLiteral(prop.key) && prop.key.value === 'name'))
        )
    );
  }

  traverse(csfFile._ast, {
    Program(path) {
      path.pushContainer(
        'body',
        t.exportNamedDeclaration(t.variableDeclaration('const', [cloned]))
      );
    },
  });

  return cloned;
};
