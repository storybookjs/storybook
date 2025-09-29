/**
 * @file Interactions should be awaited
 * @author Yann Braga
 */
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

import {
  isArrowFunctionExpression,
  isAwaitExpression,
  isCallExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isImportSpecifier,
  isMemberExpression,
  isProgram,
  isReturnStatement,
  isTSNonNullExpression,
} from '../utils/ast';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createStorybookRule({
  name: 'await-interactions',
  defaultOptions: [],
  meta: {
    severity: 'error',
    docs: {
      description: 'Interactions should be awaited',
      categories: [CategoryId.ADDON_INTERACTIONS, CategoryId.RECOMMENDED],
    },
    messages: {
      interactionShouldBeAwaited: 'Interaction should be awaited: {{method}}',
      fixSuggestion: 'Add `await` to method',
    },
    type: 'problem',
    fixable: 'code',
    hasSuggestions: true,
    schema: [],
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    // any helper functions should go here or else delete this section

    const FUNCTIONS_TO_BE_AWAITED = [
      'waitFor',
      'waitForElementToBeRemoved',
      'wait',
      'waitForElement',
      'waitForDomChange',
      'userEvent',
      'play',
    ];

    const getMethodThatShouldBeAwaited = (expr: TSESTree.CallExpression) => {
      const shouldAwait = (name: string) => {
        return FUNCTIONS_TO_BE_AWAITED.includes(name) || name.startsWith('findBy');
      };

      // When an expression is a return value it doesn't need to be awaited
      if (isArrowFunctionExpression(expr.parent) || isReturnStatement(expr.parent)) {
        return null;
      }

      if (
        isMemberExpression(expr.callee) &&
        isIdentifier(expr.callee.object) &&
        shouldAwait(expr.callee.object.name)
      ) {
        return expr.callee.object;
      }

      if (
        isTSNonNullExpression(expr.callee) &&
        isMemberExpression(expr.callee.expression) &&
        isIdentifier(expr.callee.expression.property) &&
        shouldAwait(expr.callee.expression.property.name)
      ) {
        return expr.callee.expression.property;
      }

      if (
        isMemberExpression(expr.callee) &&
        isIdentifier(expr.callee.property) &&
        shouldAwait(expr.callee.property.name)
      ) {
        return expr.callee.property;
      }

      if (
        isMemberExpression(expr.callee) &&
        isCallExpression(expr.callee.object) &&
        isIdentifier(expr.callee.object.callee) &&
        isIdentifier(expr.callee.property) &&
        expr.callee.object.callee.name === 'expect'
      ) {
        return expr.callee.property;
      }

      if (isIdentifier(expr.callee) && shouldAwait(expr.callee.name)) {
        return expr.callee;
      }

      return null;
    };

    const getClosestFunctionAncestor = (node: TSESTree.Node): TSESTree.Node | undefined => {
      const parent = node.parent;

      if (!parent || isProgram(parent)) {
        return undefined;
      }
      if (
        isArrowFunctionExpression(parent) ||
        isFunctionExpression(parent) ||
        isFunctionDeclaration(parent)
      ) {
        return node.parent;
      }

      return getClosestFunctionAncestor(parent);
    };

    const isUserEventFromStorybookImported = (node: TSESTree.ImportDeclaration) => {
      return (
        (node.source.value === '@storybook/testing-library' ||
          node.source.value === '@storybook/test') &&
        node.specifiers.find(
          (spec) =>
            isImportSpecifier(spec) &&
            'name' in spec.imported &&
            spec.imported.name === 'userEvent' &&
            spec.local.name === 'userEvent'
        ) !== undefined
      );
    };

    const isExpectFromStorybookImported = (node: TSESTree.ImportDeclaration) => {
      return (
        (node.source.value === '@storybook/jest' || node.source.value === '@storybook/test') &&
        node.specifiers.find(
          (spec) =>
            isImportSpecifier(spec) && 'name' in spec.imported && spec.imported.name === 'expect'
        ) !== undefined
      );
    };

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------
    /** @param {import('eslint').Rule.Node} node */

    let isImportedFromStorybook = true;
    const invocationsThatShouldBeAwaited = [] as Array<{
      node: TSESTree.Node;
      method: TSESTree.Identifier;
    }>;

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        isImportedFromStorybook =
          isUserEventFromStorybookImported(node) || isExpectFromStorybookImported(node);
      },
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        isImportedFromStorybook =
          isImportedFromStorybook && isIdentifier(node.id) && node.id.name !== 'userEvent';
      },
      CallExpression(node: TSESTree.CallExpression) {
        const method = getMethodThatShouldBeAwaited(node);
        if (method && !isAwaitExpression(node.parent) && !isAwaitExpression(node.parent?.parent)) {
          invocationsThatShouldBeAwaited.push({ node, method });
        }
      },
      'Program:exit': function () {
        if (isImportedFromStorybook && invocationsThatShouldBeAwaited.length) {
          invocationsThatShouldBeAwaited.forEach(({ node, method }) => {
            const parentFnNode = getClosestFunctionAncestor(node);
            const parentFnNeedsAsync =
              parentFnNode && !('async' in parentFnNode && parentFnNode.async);

            const fixFn: TSESLint.ReportFixFunction = (fixer) => {
              const fixerResult = [fixer.insertTextBefore(node, 'await ')];

              if (parentFnNeedsAsync) {
                fixerResult.push(fixer.insertTextBefore(parentFnNode, 'async '));
              }
              return fixerResult;
            };

            context.report({
              node,
              messageId: 'interactionShouldBeAwaited',
              data: {
                method: method.name,
              },
              fix: fixFn,
              suggest: [
                {
                  messageId: 'fixSuggestion',
                  fix: fixFn,
                },
              ],
            });
          });
        }
      },
    };
  },
});
