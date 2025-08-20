/**
 * @file Meta should have inline properties
 * @author Yann Braga
 */
import type { TSESTree } from '@typescript-eslint/utils';

import { getMetaObjectExpression } from '../utils';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

type TDynamicProperty = (TSESTree.MethodDefinition | TSESTree.Property) & {
  key: TSESTree.Identifier | TSESTree.PrivateIdentifier;
};

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createStorybookRule({
  name: 'meta-inline-properties',
  defaultOptions: [{ csfVersion: 3 }],
  meta: {
    type: 'problem',
    severity: 'error',
    docs: {
      description: 'Meta should only have inline properties',
      categories: [CategoryId.CSF, CategoryId.RECOMMENDED],
      excludeFromConfig: true,
    },
    messages: {
      metaShouldHaveInlineProperties: 'Meta should only have inline properties: {{property}}',
    },
    schema: [
      {
        type: 'object',
        properties: {
          csfVersion: {
            type: 'number',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    // variables should be defined here

    // In case we need to get options defined in the rule schema
    // const options = context.options[0] || {}
    // const csfVersion = options.csfVersion

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------
    const isInline = <T>(node: T | TDynamicProperty): node is T => {
      if (!(node && typeof node === 'object' && 'value' in node)) {
        return false;
      }

      return (
        node.value.type === 'ObjectExpression' ||
        node.value.type === 'Literal' ||
        node.value.type === 'ArrayExpression'
      );
    };
    // any helper functions should go here or else delete this section

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    return {
      ExportDefaultDeclaration(node) {
        const meta = getMetaObjectExpression(node, context);
        if (!meta) {
          return null;
        }

        const ruleProperties = ['title', 'args'];
        const dynamicProperties: TDynamicProperty[] = [];

        const metaNodes = meta.properties.filter(
          (prop) => 'key' in prop && 'name' in prop.key && ruleProperties.includes(prop.key.name)
        );

        metaNodes.forEach((metaNode) => {
          if (!isInline(metaNode)) {
            dynamicProperties.push(metaNode);
          }
        });

        if (dynamicProperties.length > 0) {
          dynamicProperties.forEach((propertyNode) => {
            context.report({
              node: propertyNode,
              messageId: 'metaShouldHaveInlineProperties',
              data: {
                property: propertyNode.key?.name,
              },
            });
          });
        }
      },
    };
  },
});
