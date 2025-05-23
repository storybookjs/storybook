/**
 * @file Named exports should not use the name annotation if it is redundant to the name that would
 *   be generated by the export name
 * @author Yann Braga
 */
import { storyNameFromExport } from 'storybook/internal/csf';

import {
  isExpressionStatement,
  isIdentifier,
  isLiteral,
  isMetaProperty,
  isObjectExpression,
  isProperty,
  isSpreadElement,
  isVariableDeclaration,
} from '../utils/ast';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export = createStorybookRule({
  name: 'no-redundant-story-name',
  defaultOptions: [],
  meta: {
    type: 'suggestion',
    fixable: 'code',
    hasSuggestions: true,
    severity: 'warn',
    docs: {
      description: 'A story should not have a redundant name property',
      categories: [CategoryId.CSF, CategoryId.RECOMMENDED],
    },
    messages: {
      removeRedundantName: 'Remove redundant name',
      storyNameIsRedundant:
        'Named exports should not use the name annotation if it is redundant to the name that would be generated by the export name',
    },
    schema: [],
  },

  create(context) {
    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    return {
      // CSF3
      ExportNamedDeclaration: function (node) {
        // if there are specifiers, node.declaration should be null

        // if there are specifiers, node.declaration should be null
        if (!node.declaration) {
          return;
        }

        const decl = node.declaration;
        if (isVariableDeclaration(decl)) {
          const declaration = decl.declarations[0];

          if (declaration == null) {
            return;
          }
          const { id, init } = declaration;
          if (isIdentifier(id) && isObjectExpression(init)) {
            const storyNameNode = init.properties.find(
              (prop) =>
                isProperty(prop) &&
                isIdentifier(prop.key) &&
                (prop.key?.name === 'name' || prop.key?.name === 'storyName')
            );

            if (!storyNameNode) {
              return;
            }

            const { name } = id;
            const resolvedStoryName = storyNameFromExport(name);

            if (
              !isSpreadElement(storyNameNode) &&
              isLiteral(storyNameNode.value) &&
              storyNameNode.value.value === resolvedStoryName
            ) {
              context.report({
                node: storyNameNode,
                messageId: 'storyNameIsRedundant',
                suggest: [
                  {
                    messageId: 'removeRedundantName',
                    fix: function (fixer) {
                      return fixer.remove(storyNameNode);
                    },
                  },
                ],
              });
            }
          }
        }
      },
      // CSF2
      AssignmentExpression: function (node) {
        if (!isExpressionStatement(node.parent)) {
          return;
        }

        const { left, right } = node;

        if (
          'property' in left &&
          isIdentifier(left.property) &&
          !isMetaProperty(left) &&
          left.property.name === 'storyName'
        ) {
          if (!('name' in left.object && 'value' in right)) {
            return;
          }

          const propertyName = left.object.name;
          const propertyValue = right.value;
          const resolvedStoryName = storyNameFromExport(propertyName);

          if (propertyValue === resolvedStoryName) {
            context.report({
              node: node,
              messageId: 'storyNameIsRedundant',
              suggest: [
                {
                  messageId: 'removeRedundantName',
                  fix: function (fixer) {
                    return fixer.remove(node);
                  },
                },
              ],
            });
          }
        }
      },
    };
  },
});
