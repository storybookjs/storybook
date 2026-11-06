/**
 * @file Component property should be set
 * @author Yann Braga
 */
import type { TSESTree } from '@typescript-eslint/types';

import { getFactoryMetaObjectExpression, getMetaObjectExpression } from '../utils/index.ts';
import { isSpreadElement } from '../utils/ast.ts';
import { CategoryId } from '../utils/constants.ts';
import { createStorybookRule } from '../utils/create-storybook-rule.ts';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createStorybookRule({
  name: 'csf-component',
  defaultOptions: [],
  meta: {
    type: 'suggestion',
    severity: 'warn',
    docs: {
      description: 'The component property should be set',
      categories: [CategoryId.CSF],
    },
    messages: {
      missingComponentProperty: 'Missing component property.',
    },
    schema: [],
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    // any helper functions should go here or else delete this section

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    const checkComponentProperty = (meta: TSESTree.ObjectExpression, reportNode: TSESTree.Node) => {
      const componentProperty = meta.properties.find(
        (property) =>
          !isSpreadElement(property) && 'name' in property.key && property.key.name === 'component'
      );

      if (!componentProperty) {
        context.report({
          node: reportNode,
          messageId: 'missingComponentProperty',
        });
      }
    };

    return {
      ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
        const meta = getMetaObjectExpression(node, context);

        if (meta) {
          checkComponentProperty(meta, node);
        }
      },
      CallExpression(node: TSESTree.CallExpression) {
        const meta = getFactoryMetaObjectExpression(node, context);

        if (meta) {
          checkComponentProperty(meta, node);
        }
      },
    };
  },
});
