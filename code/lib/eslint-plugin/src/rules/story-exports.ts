/**
 * @file A story file must contain at least one story export
 * @author Yann Braga
 */
import type { IncludeExcludeOptions } from '../utils/csf-helpers.ts';

import type { TSESTree } from '@typescript-eslint/types';

import {
  getAllNamedExports,
  getDescriptor,
  getMetaObjectExpression,
  isFactoryStoryExport,
  isValidStoryExport,
  parseFactoryMetaCall,
} from '../utils/index.ts';
import { isImportDeclaration } from '../utils/ast.ts';
import { CategoryId } from '../utils/constants.ts';
import { createStorybookRule } from '../utils/create-storybook-rule.ts';

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
    let metaIsFactory = false;
    const namedExports: TSESTree.Identifier[] = [];

    const readNonStoryExportsConfig = (metaObject: TSESTree.ObjectExpression) => {
      try {
        nonStoryExportsConfig = {
          excludeStories: getDescriptor(metaObject, 'excludeStories'),
          includeStories: getDescriptor(metaObject, 'includeStories'),
        };
      } catch {
        //
      }
    };

    return {
      ImportSpecifier(node) {
        if ('name' in node.imported && node.imported.name === 'storiesOf') {
          hasStoriesOfImport = true;
        }
      },
      ExportDefaultDeclaration: function (node) {
        meta = getMetaObjectExpression(node, context);
        if (meta) {
          readNonStoryExportsConfig(meta);
        }
      },
      CallExpression: function (node) {
        const factoryMeta = parseFactoryMetaCall(node, context);
        if (factoryMeta?.validPreviewImport) {
          metaIsFactory = true;
          if (factoryMeta.metaObject) {
            meta = factoryMeta.metaObject;
            readNonStoryExportsConfig(factoryMeta.metaObject);
          }
        }
      },
      ExportNamedDeclaration: function (node) {
        namedExports.push(...getAllNamedExports(node));
      },
      'Program:exit': function (program: TSESTree.Program) {
        if (hasStoriesOfImport || (!meta && !metaIsFactory)) {
          return;
        }

        const storyExports = namedExports.filter(
          (exp) =>
            isValidStoryExport(exp, nonStoryExportsConfig) &&
            (!metaIsFactory || isFactoryStoryExport(exp))
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
