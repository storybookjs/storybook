/**
 * @file Pass a context object when invoking a play function
 * @author Yann Braga
 */
import type { TSESTree } from '@typescript-eslint/utils';

import {
  isArrowFunctionExpression,
  isIdentifier,
  isMemberExpression,
  isObjectExpression,
  isObjectPattern,
  isRestElement,
  isSpreadElement,
  isTSNonNullExpression,
} from '../utils/ast';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createStorybookRule({
  name: 'context-in-play-function',
  defaultOptions: [],
  meta: {
    type: 'problem',
    severity: 'error',
    docs: {
      description: 'Pass a context when invoking play function of another story',
      categories: [CategoryId.RECOMMENDED, CategoryId.ADDON_INTERACTIONS],
    },
    messages: {
      passContextToPlayFunction: 'Pass a context when invoking play function of another story',
    },
    fixable: undefined,
    schema: [],
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    // any helper functions should go here or else delete this section

    const isPlayFunctionFromAnotherStory = (expr: TSESTree.CallExpression) => {
      if (
        isTSNonNullExpression(expr.callee) &&
        isMemberExpression(expr.callee.expression) &&
        isIdentifier(expr.callee.expression.property) &&
        expr.callee.expression.property.name === 'play'
      ) {
        return true;
      }

      if (
        isMemberExpression(expr.callee) &&
        isIdentifier(expr.callee.property) &&
        expr.callee.property.name === 'play'
      ) {
        return true;
      }

      return false;
    };

    const getParentParameterName = (node: TSESTree.Node): string | undefined => {
      if (!isArrowFunctionExpression(node)) {
        if (!node.parent) {
          return undefined;
        }
        return getParentParameterName(node.parent);
      }
      // No parameter found
      if (node.params.length === 0) {
        return undefined;
      }

      if (node.params.length >= 1) {
        const param = node.params[0];
        if (isIdentifier(param)) {
          return param.name;
        }
        if (isObjectPattern(param)) {
          if (
            param.properties.find((prop) => {
              return (
                prop.type === 'Property' &&
                prop.key.type === 'Identifier' &&
                prop.key.name === 'context'
              );
            })
          ) {
            return 'context';
          }

          const restElement = param.properties.find(isRestElement);
          if (!restElement || !isIdentifier(restElement.argument)) {
            // No rest element found
            return undefined;
          }
          return restElement.argument.name;
        }
      }
      return undefined;
    };

    // Expression passing an argument called context OR spreading a variable called context
    const isNotPassingContextCorrectly = (expr: TSESTree.CallExpression) => {
      const firstExpressionArgument = expr.arguments[0];

      if (!firstExpressionArgument) {
        return true;
      }

      const contextVariableName = getParentParameterName(expr);

      if (!contextVariableName) {
        return true;
      }

      if (
        expr.arguments.length === 1 &&
        isIdentifier(firstExpressionArgument) &&
        firstExpressionArgument.name === contextVariableName
      ) {
        return false;
      }

      if (
        isObjectExpression(firstExpressionArgument) &&
        firstExpressionArgument.properties.some((prop) => {
          return (
            isSpreadElement(prop) &&
            isIdentifier(prop.argument) &&
            prop.argument.name === contextVariableName
          );
        })
      ) {
        return false;
      }

      return true;
    };

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    const invocationsWithoutProperContext: TSESTree.Node[] = [];

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (isPlayFunctionFromAnotherStory(node) && isNotPassingContextCorrectly(node)) {
          invocationsWithoutProperContext.push(node);
        }
      },
      'Program:exit': function () {
        invocationsWithoutProperContext.forEach((node) => {
          context.report({
            node,
            messageId: 'passContextToPlayFunction',
          });
        });
      },
    };
  },
});
