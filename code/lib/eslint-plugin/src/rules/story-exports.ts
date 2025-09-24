/**
 * @file A story file must contain at least one story export
 * @author Yann Braga
 */
import type { IncludeExcludeOptions } from 'storybook/internal/csf';

import type { TSESTree } from '@typescript-eslint/utils';

import {
  getAllNamedExports,
  getDescriptor,
  getMetaObjectExpression,
  isValidStoryExport,
} from '../utils';
import { isImportDeclaration } from '../utils/ast';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createStorybookRule({
  name: 'story-exports',
  defaultOptions: [],
  meta: {
    type: 'problem',
    severity: 'error',
    docs: {
      description: 'A story file must contain at least one story export',
      categories: [CategoryId.RECOMMENDED, CategoryId.CSF],
    },
    messages: {
      shouldHaveStoryExport: 'The file should have at least one story export',
      shouldHaveStoryExportWithFilters:
        'The file should have at least one story export. Make sure the includeStories/excludeStories you defined are correct, otherwise Storybook will not use any stories for this file.',
      addStoryExport: 'Add a story export',
    },
    fixable: undefined, // change to 'code' once we have autofixes
    schema: [],
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    let hasStoriesOfImport = false;
    let nonStoryExportsConfig: IncludeExcludeOptions = {};
    let meta: TSESTree.ObjectExpression | null;
    const namedExports: TSESTree.Identifier[] = [];

    return {
      ImportSpecifier(node) {
        if ('name' in node.imported && node.imported.name === 'storiesOf') {
          hasStoriesOfImport = true;
        }
      },
      ExportDefaultDeclaration: function (node) {
        meta = getMetaObjectExpression(node, context);
        if (meta) {
          try {
            nonStoryExportsConfig = {
              excludeStories: getDescriptor(meta, 'excludeStories'),
              includeStories: getDescriptor(meta, 'includeStories'),
            };
          } catch (err) {
            //
          }
        }
      },
      ExportNamedDeclaration: function (node) {
        namedExports.push(...getAllNamedExports(node));
      },
      'Program:exit': function (program: TSESTree.Program) {
        if (hasStoriesOfImport || !meta) {
          return;
        }

        const storyExports = namedExports.filter((exp) =>
          isValidStoryExport(exp, nonStoryExportsConfig)
        );

        if (storyExports.length) {
          return;
        }

        const firstNonImportStatement = program.body.find((n) => !isImportDeclaration(n));
        const node = firstNonImportStatement || program.body[0] || program;

        // @TODO: bring apply this autofix with CSF3 release
        // const fix = (fixer) => fixer.insertTextAfter(node, `\n\nexport const Default = {}`)

        const hasFilter =
          nonStoryExportsConfig.includeStories || nonStoryExportsConfig.excludeStories;
        const report = {
          node,
          messageId: hasFilter ? 'shouldHaveStoryExportWithFilters' : 'shouldHaveStoryExport',
          // fix,
        } as const;

        context.report(report);
      },
    };
  },
});
