/**
 * This is heavily based on the react-docgen `displayNameHandler`
 * (https://github.com/reactjs/react-docgen/blob/26c90c0dd105bf83499a83826f2a6ff7a724620d/src/handlers/displayNameHandler.ts)
 * but instead defines an `actualName` property on the generated docs that is taken first from the
 * component's actual name. This addresses an issue where the name that the generated docs are
 * stored under is incorrectly named with the `displayName` and not the component's actual name.
 *
 * This is inspired by `actualNameHandler` from
 * https://github.com/storybookjs/babel-plugin-react-docgen, but is modified directly from
 * displayNameHandler, using the same approach as babel-plugin-react-docgen.
 */
import type { Handler, NodePath, babelTypes as t } from 'react-docgen';
import { utils } from 'react-docgen';

const { getNameOrValue, isReactForwardRefCall } = utils;

const actualNameHandler: Handler = function actualNameHandler(documentation, componentDefinition) {
  documentation.set('definedInFile', componentDefinition.hub.file.opts.filename);

  if (
    (componentDefinition.isClassDeclaration() || componentDefinition.isFunctionDeclaration()) &&
    componentDefinition.has('id')
  ) {
    documentation.set(
      'actualName',
      getNameOrValue(componentDefinition.get('id') as NodePath<t.Identifier>)
    );
  } else if (
    componentDefinition.isArrowFunctionExpression() ||
    componentDefinition.isFunctionExpression() ||
    isReactForwardRefCall(componentDefinition)
  ) {
    let currentPath: NodePath = componentDefinition;

    while (currentPath.parentPath) {
      if (currentPath.parentPath.isVariableDeclarator()) {
        documentation.set('actualName', getNameOrValue(currentPath.parentPath.get('id')));
        return;
      }
      if (currentPath.parentPath.isAssignmentExpression()) {
        const leftPath = currentPath.parentPath.get('left');

        if (leftPath.isIdentifier() || leftPath.isLiteral()) {
          documentation.set('actualName', getNameOrValue(leftPath));
          return;
        }
      }

      currentPath = currentPath.parentPath;
    }
    // Could not find an actual name
    documentation.set('actualName', '');
  }
};

export default actualNameHandler;
