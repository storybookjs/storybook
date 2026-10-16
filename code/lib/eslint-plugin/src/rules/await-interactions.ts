/**
 * @file Interactions should be awaited
 * @author Yann Braga
 */
import type { TSESTree } from '@typescript-eslint/types';
import type { TSESLint } from '@typescript-eslint/utils';

import {
  ASTUtils,
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
} from '../utils/ast.ts';
import { CategoryId } from '../utils/constants.ts';
import { createStorybookRule } from '../utils/create-storybook-rule.ts';

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

    const STORYBOOK_USER_EVENT_MODULES = ['@storybook/testing-library', '@storybook/test'];
    const STORYBOOK_EXPECT_MODULES = ['@storybook/jest', '@storybook/test'];

    const getScope = (node: TSESTree.Node) => {
      const { sourceCode } = context;

      // Compatibility implementation for eslint v8.x and v9.x or later
      // see https://eslint.org/blog/2023/09/preparing-custom-rules-eslint-v9/#context.getscope()
      return sourceCode.getScope ? sourceCode.getScope(node) : context.getScope();
    };

    const isStorybookImport = (
      identifier: TSESTree.Identifier,
      importedName: 'userEvent' | 'expect',
      moduleNames: string[],
      scope: TSESLint.Scope.Scope
    ) => {
      const variable = ASTUtils.findVariable(scope, identifier.name);

      if (!variable) {
        return identifier.name === importedName;
      }

      return variable.defs.some((def) => {
        const node = def.node;
        const parent = node.parent;

        return (
          isImportSpecifier(node) &&
          parent?.type === 'ImportDeclaration' &&
          moduleNames.includes(String(parent.source.value)) &&
          'name' in node.imported &&
          node.imported.name === importedName
        );
      });
    };

    const getMethodThatShouldBeAwaited = (expr: TSESTree.CallExpression) => {
      const scope = getScope(expr);
      const shouldAwait = (name: string) => {
        return (
          (name !== 'userEvent' && FUNCTIONS_TO_BE_AWAITED.includes(name)) ||
          name.startsWith('findBy')
        );
      };
      const isUserEvent = (identifier: TSESTree.Identifier) => {
        return isStorybookImport(identifier, 'userEvent', STORYBOOK_USER_EVENT_MODULES, scope);
      };
      const isExpect = (identifier: TSESTree.Identifier) => {
        return isStorybookImport(identifier, 'expect', STORYBOOK_EXPECT_MODULES, scope);
      };

      // When an expression is a return value it doesn't need to be awaited
      if (isArrowFunctionExpression(expr.parent) || isReturnStatement(expr.parent)) {
        return null;
      }

      if (isMemberExpression(expr.callee) && isIdentifier(expr.callee.object)) {
        const shouldAwaitObject = shouldAwait(expr.callee.object.name);
        const isStorybookUserEvent = isUserEvent(expr.callee.object);

        if (shouldAwaitObject || isStorybookUserEvent) {
          return isStorybookUserEvent && expr.callee.object.name !== 'userEvent'
            ? ({ ...expr.callee.object, name: 'userEvent' } as TSESTree.Identifier)
            : expr.callee.object;
        }
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
        isExpect(expr.callee.object.callee)
      ) {
        return expr.callee.property;
      }

      if (
        isIdentifier(expr.callee) &&
        (shouldAwait(expr.callee.name) || isUserEvent(expr.callee))
      ) {
        return isUserEvent(expr.callee) && expr.callee.name !== 'userEvent'
          ? ({ ...expr.callee, name: 'userEvent' } as TSESTree.Identifier)
          : expr.callee;
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

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------
    /** @param {import('eslint').Rule.Node} node */

    const invocationsThatShouldBeAwaited = [] as Array<{
      node: TSESTree.Node;
      method: TSESTree.Identifier;
    }>;

    return {
      CallExpression(node: TSESTree.CallExpression) {
        const method = getMethodThatShouldBeAwaited(node);
        if (method && !isAwaitExpression(node.parent) && !isAwaitExpression(node.parent?.parent)) {
          invocationsThatShouldBeAwaited.push({ node, method });
        }
      },
      'Program:exit': function () {
        if (invocationsThatShouldBeAwaited.length) {
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
