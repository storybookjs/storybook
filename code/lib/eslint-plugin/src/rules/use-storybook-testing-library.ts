/**
 * @file Do not use testing library directly on stories
 * @author Yann Braga
 */
import type { TSESTree } from '@typescript-eslint/utils';

import { isImportDefaultSpecifier } from '../utils/ast';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------
export default createStorybookRule({
  name: 'use-storybook-testing-library',
  defaultOptions: [],
  meta: {
    type: 'suggestion',
    fixable: 'code',
    hasSuggestions: true,
    severity: 'error',
    docs: {
      description: 'Do not use testing-library directly on stories',
      categories: [CategoryId.ADDON_INTERACTIONS, CategoryId.RECOMMENDED],
    },
    schema: [],
    messages: {
      updateImports: 'Update imports',
      dontUseTestingLibraryDirectly:
        'Do not use `{{library}}` directly in the story. You should import the functions from `@storybook/test` (preferrably) or `@storybook/testing-library` instead.',
    },
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------
    const getRangeWithoutQuotes = (source: TSESTree.StringLiteral): TSESTree.Range => {
      return [
        // Not sure how to improve this. If I use node.source.range
        // it will eat the quotes and we do not want to specify whether the quotes are single or double
        source.range[0] + 1,
        source.range[1] - 1,
      ];
    };

    const hasDefaultImport = (specifiers: TSESTree.ImportClause[]) =>
      specifiers.find((s) => isImportDefaultSpecifier(s));

    const getSpecifiers = (node: TSESTree.ImportDeclaration) => {
      const { specifiers } = node;
      if (!specifiers[0]) {
        return null;
      }

      const start = specifiers[0].range[0];
      const previousSpecifier = specifiers[specifiers.length - 1];
      if (!previousSpecifier) {
        return null;
      }

      let end = previousSpecifier.range[1];

      // this weird hack is necessary because the specifier range
      // does not include the closing brace:
      //
      // import foo, { bar } from 'baz';
      //        ^        ^ end
      const fullText = context.getSourceCode().text;
      const importEnd = node.range[1];
      const closingBrace = fullText.indexOf('}', end - 1);
      if (closingBrace > -1 && closingBrace <= importEnd) {
        end = closingBrace + 1;
      }
      const text = fullText.substring(start, end);

      return { range: [start, end] as TSESTree.Range, text };
    };

    const fixSpecifiers = (specifiersText: string) => {
      const flattened = specifiersText
        .replace('{', '')
        .replace('}', '')
        .replace(/\s\s+/g, ' ')
        .trim();
      return `{ ${flattened} }`;
    };

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    return {
      ImportDeclaration(node) {
        if (node.source.value.includes('@testing-library')) {
          context.report({
            node,
            messageId: 'dontUseTestingLibraryDirectly',
            data: {
              library: node.source.value,
            },
            *fix(fixer) {
              yield fixer.replaceTextRange(
                getRangeWithoutQuotes(node.source),
                '@storybook/testing-library'
              );
              if (hasDefaultImport(node.specifiers)) {
                const specifiers = getSpecifiers(node);
                if (specifiers) {
                  const { range, text } = specifiers;
                  yield fixer.replaceTextRange(range, fixSpecifiers(text));
                }
              }
            },
            suggest: [
              {
                messageId: 'updateImports',
                *fix(fixer) {
                  yield fixer.replaceTextRange(
                    getRangeWithoutQuotes(node.source),
                    '@storybook/testing-library'
                  );
                  if (hasDefaultImport(node.specifiers)) {
                    const specifiers = getSpecifiers(node);
                    if (specifiers) {
                      const { range, text } = specifiers;
                      yield fixer.replaceTextRange(range, fixSpecifiers(text));
                    }
                  }
                },
              },
            ],
          });
        }
      },
    };
  },
});
