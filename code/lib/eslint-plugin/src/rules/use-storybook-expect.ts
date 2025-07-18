/**
 * @file Use expect from '@storybook/jest'
 * @author Yann Braga
 */
import type { TSESTree } from '@typescript-eslint/utils';

import { isIdentifier, isImportSpecifier } from '../utils/ast';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

type TDefaultOptions = {
  storybookJestPath?: string;
}[];

export default createStorybookRule<TDefaultOptions, string>({
  name: 'use-storybook-expect',
  defaultOptions: [],
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    severity: 'error',
    docs: {
      description: 'Use expect from `@storybook/test`, `storybook/test` or `@storybook/jest`',
      categories: [CategoryId.ADDON_INTERACTIONS, CategoryId.RECOMMENDED],
    },
    messages: {
      useExpectFromStorybook:
        'Do not use global expect directly in the story. You should import it from `@storybook/test` (preferrably) or `@storybook/jest` instead.',
    },
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    const isExpectFromStorybookImported = (node: TSESTree.ImportDeclaration) => {
      const { value: packageName } = node.source;
      const usesExpectFromStorybook =
        packageName === '@storybook/jest' ||
        packageName === '@storybook/test' ||
        packageName === 'storybook/test';
      return (
        usesExpectFromStorybook &&
        node.specifiers.find(
          (spec) =>
            isImportSpecifier(spec) && 'name' in spec.imported && spec.imported.name === 'expect'
        )
      );
    };

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    let isImportingFromStorybookExpect = false;
    const expectInvocations: TSESTree.Identifier[] = [];

    return {
      ImportDeclaration(node) {
        if (isExpectFromStorybookImported(node)) {
          isImportingFromStorybookExpect = true;
        }
      },
      CallExpression(node) {
        if (!isIdentifier(node.callee)) {
          return null;
        }

        if (node.callee.name === 'expect') {
          expectInvocations.push(node.callee);
        }
      },
      'Program:exit': function () {
        if (!isImportingFromStorybookExpect && expectInvocations.length) {
          expectInvocations.forEach((node) => {
            context.report({
              node,
              messageId: 'useExpectFromStorybook',
            });
          });
        }
      },
    };
  },
});
