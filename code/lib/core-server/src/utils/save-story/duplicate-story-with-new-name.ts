/* eslint-disable no-underscore-dangle */
import type { CsfFile } from '@storybook/csf-tools';
import * as traverse from '@babel/traverse';
import * as t from '@babel/types';
import { SaveStoryError } from './utils';

type In = ReturnType<CsfFile['parse']>;

export const duplicateStoryWithNewName = (csfFile: In, storyName: string, newStoryName: string) => {
  const node = csfFile._storyExports[storyName];
  const cloned = t.cloneNode(node) as t.VariableDeclarator;

  if (!cloned) {
    throw new SaveStoryError(`cannot clone Node`);
  }

  let found = false;
  traverse.default(cloned, {
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

  // detect CSF2 and throw
  if (t.isArrowFunctionExpression(cloned.init) || t.isCallExpression(cloned.init)) {
    throw new SaveStoryError(`Creating a new story based on a CSF2 story is not supported`);
  }

  traverse.default(csfFile._ast, {
    Program(path) {
      path.pushContainer(
        'body',
        t.exportNamedDeclaration(t.variableDeclaration('const', [cloned]))
      );
    },
  });

  return cloned;
};
