/**
 * @fileoverview Component property should be set
 * @author Yann Braga
 */

import { TSESTree } from '@typescript-eslint/utils'
import { getMetaObjectExpression } from '../utils'
import { CategoryId } from '../utils/constants'
import { createStorybookRule } from '../utils/create-storybook-rule'
import { isSpreadElement } from '../utils/ast'

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export = createStorybookRule({
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

    return {
      ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
        const meta = getMetaObjectExpression(node, context)

        if (!meta) {
          return null
        }

        const componentProperty = meta.properties.find(
          (property) =>
            !isSpreadElement(property) &&
            'name' in property.key &&
            property.key.name === 'component'
        )

        if (!componentProperty) {
          context.report({
            node,
            messageId: 'missingComponentProperty',
          })
        }
      },
    }
  },
})
