/**
 * @file Story files should have a default export
 * @author Yann Braga
 */
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import path from 'path';

import { isIdentifier, isImportDeclaration, isLiteral } from '../utils/ast';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

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
      VariableDeclaration(node) {
        // we check for variables declared at the root in a CSF4 style
        // e.g. const meta = config.meta({})
        if (node.parent.type === 'Program') {
          node.declarations.forEach((declaration) => {
            const init = declaration.init;

            if (init && init.type === 'CallExpression') {
              const callee = init.callee;

              if (
                callee.type === 'MemberExpression' &&
                callee.property.type === 'Identifier' &&
                callee.property.name === 'meta'
              ) {
                isCsf4Style = true;
              }
            }
          });
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
          const componentName = getComponentName(program, context.getFilename());
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
