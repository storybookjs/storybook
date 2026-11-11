/**
 * @file Story files should have a default export
 * @author Yann Braga
 */
import type { TSESTree } from '@typescript-eslint/types';
import type { TSESLint } from '@typescript-eslint/utils';
import path from 'path';

import { parseFactoryMetaCall } from '../utils/index.ts';
import { isIdentifier, isImportDeclaration, isLiteral } from '../utils/ast.ts';
import { CategoryId } from '../utils/constants.ts';
import { createStorybookRule } from '../utils/create-storybook-rule.ts';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createStorybookRule({
  name: 'default-exports',
  defaultOptions: [],
  meta: {
    type: 'problem',
    severity: 'error',
    docs: {
      description: 'Story files should have a default export',
      categories: [CategoryId.CSF, CategoryId.RECOMMENDED],
    },
    messages: {
      shouldHaveDefaultExport: 'The file should have a default export.',
      fixSuggestion: 'Add default export',
    },
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
    const getComponentName = (node: TSESTree.Program, filePath: string) => {
      const name = path.basename(filePath).split('.')[0];
      const imported = node.body.find((stmt: TSESTree.Node) => {
        if (
          isImportDeclaration(stmt) &&
          isLiteral(stmt.source) &&
          stmt.source.value.startsWith(`./${name}`)
        ) {
          return !!stmt.specifiers.find(
            (spec) => isIdentifier(spec.local) && spec.local.name === name
          );
        }
      });
      return imported ? name : null;
    };

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    let hasDefaultExport = false;
    let isCsf4Style = false;
    let hasStoriesOfImport = false;

    return {
      ImportSpecifier(node) {
        if ('name' in node.imported && node.imported.name === 'storiesOf') {
          hasStoriesOfImport = true;
        }
      },
      CallExpression(node) {
        // CSF4 style: the meta comes from a factory imported from the preview file,
        // e.g. const meta = preview.meta({})
        if (parseFactoryMetaCall(node, context)) {
          isCsf4Style = true;
        }
      },
      ExportDefaultSpecifier: function () {
        hasDefaultExport = true;
      },
      ExportDefaultDeclaration: function () {
        hasDefaultExport = true;
      },
      'Program:exit': function (program: TSESTree.Program) {
        if (!isCsf4Style && !hasDefaultExport && !hasStoriesOfImport) {
          const componentName = getComponentName(program, context.filename);
          const firstNonImportStatement = program.body.find((n) => !isImportDeclaration(n));
          const node = firstNonImportStatement || program.body[0] || program;

          const report = {
            node,
            messageId: 'shouldHaveDefaultExport',
          } as const;

          const fix: TSESLint.ReportFixFunction = (fixer) => {
            const metaDeclaration = componentName
              ? `export default { component: ${componentName} }\n`
              : 'export default {}\n';
            return fixer.insertTextBefore(node, metaDeclaration);
          };

          context.report({
            ...report,
            fix,
            suggest: [
              {
                messageId: 'fixSuggestion',
                fix,
              },
            ],
          });
        }
      },
    };
  },
});
