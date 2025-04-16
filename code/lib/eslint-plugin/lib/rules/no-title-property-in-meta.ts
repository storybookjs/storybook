/**
 * @fileoverview No title property in meta
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
  name: 'no-title-property-in-meta',
  defaultOptions: [],
  meta: {
    type: 'problem',
    fixable: 'code',
    hasSuggestions: true,
    severity: 'error',
    docs: {
      description: 'Do not define a title in meta',
      categories: [CategoryId.CSF_STRICT],
    },
    messages: {
      removeTitleInMeta: 'Remove title property from meta',
      noTitleInMeta: `CSF3 does not need a title in meta`,
    },
    schema: [],
  },
  create: function (context) {
    return {
      ExportDefaultDeclaration: function (node) {
        const meta = getMetaObjectExpression(node, context)
        if (!meta) {
          return null
        }

        const titleNode = meta.properties.find(
          (prop) => !isSpreadElement(prop) && 'name' in prop.key && prop.key?.name === 'title'
        )

        if (titleNode) {
          context.report({
            node: titleNode,
            messageId: 'noTitleInMeta',
            suggest: [
              {
                messageId: 'removeTitleInMeta',
                fix(fixer) {
                  const fullText = context.getSourceCode().text
                  const propertyTextWithExtraCharacter = fullText.slice(
                    titleNode.range[0],
                    titleNode.range[1] + 1
                  )
                  const hasComma = propertyTextWithExtraCharacter.slice(-1) === ','
                  const propertyRange: TSESTree.Range = [
                    titleNode.range[0],
                    hasComma ? titleNode.range[1] + 1 : titleNode.range[1],
                  ]
                  return fixer.removeRange(propertyRange)
                },
              },
            ],
          })
        }
      },
    }
  },
})
