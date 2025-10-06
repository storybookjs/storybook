/**
 * @file Prefer pascal case
 * @author Yann Braga
 */
import type { IncludeExcludeOptions } from 'storybook/internal/csf';
import { isExportStory } from 'storybook/internal/csf';

import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ASTUtils } from '@typescript-eslint/utils';

import { getDescriptor, getMetaObjectExpression } from '../utils';
import { isIdentifier, isVariableDeclaration } from '../utils/ast';
import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default createStorybookRule({
  name: 'prefer-pascal-case',
  defaultOptions: [],
  meta: {
    type: 'suggestion',
    fixable: 'code',
    hasSuggestions: true,
    severity: 'warn',
    docs: {
      description: 'Stories should use PascalCase',
      categories: [CategoryId.RECOMMENDED],
    },
    messages: {
      convertToPascalCase: 'Use pascal case',
      usePascalCase: 'The story should use PascalCase notation: {{name}}',
    },
    schema: [],
  },

  create(context) {
    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    const isPascalCase = (str: string) => /^[A-Z]+([a-z0-9]?)+/.test(str);
    const toPascalCase = (str: string) => {
      return str
        .replace(new RegExp(/[-_]+/, 'g'), ' ')
        .replace(new RegExp(/[^\w\s]/, 'g'), '')
        .replace(
          new RegExp(/\s+(.)(\w+)/, 'g'),
          (_, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`
        )
        .replace(new RegExp(/\s/, 'g'), '')
        .replace(new RegExp(/\w/), (s) => s.toUpperCase());
    };
    const getModuleScope = (): TSESLint.Scope.Scope | undefined => {
      const { sourceCode } = context;

      // Compatibility implementation for eslint v8.x and v9.x or later
      // see https://eslint.org/blog/2023/09/preparing-custom-rules-eslint-v9/#context.getscope()
      // @ts-expect-error keep it for compatibility with eslint v8.x
      if (sourceCode.getScope) {
        // for eslint v9.x or later
        return sourceCode.scopeManager?.scopes?.find(
          (scope: TSESLint.Scope.Scope) => scope.type === 'module'
        );
      } else {
        // for eslint v8.x
        return context
          .getScope()
          .childScopes.find((scope) => scope.type === 'module') as unknown as TSESLint.Scope.Scope;
      }
    };

    const checkAndReportError = (id: TSESTree.Identifier, nonStoryExportsConfig = {}) => {
      const { name } = id;
      if (!isExportStory(name, nonStoryExportsConfig) || name === '__namedExportsOrder') {
        return null;
      }

      if (!name.startsWith('_') && !isPascalCase(name)) {
        context.report({
          node: id,
          messageId: 'usePascalCase',
          data: {
            name,
          },
          suggest: [
            {
              messageId: 'convertToPascalCase',
              *fix(fixer) {
                const fullText = context.getSourceCode().text;
                const fullName = fullText.slice(id.range[0], id.range[1]);
                const suffix = fullName.substring(name.length);
                const pascal = toPascalCase(name);
                yield fixer.replaceTextRange(id.range, pascal + suffix);

                const scope = getModuleScope();
                if (scope) {
                  const variable = ASTUtils.findVariable(scope, name);
                  const referenceCount = variable?.references?.length || 0;

                  for (let i = 0; i < referenceCount; i++) {
                    const ref = variable?.references[i];
                    if (ref && !ref.init) {
                      yield fixer.replaceTextRange(ref.identifier.range, pascal);
                    }
                  }
                }
              },
            },
          ],
        });
      }
    };

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    let meta;
    let nonStoryExportsConfig: IncludeExcludeOptions;
    const namedExports: TSESTree.Identifier[] = [];
    let hasStoriesOfImport = false;

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
      ExportNamedDeclaration: function (node: TSESTree.ExportNamedDeclaration) {
        // if there are specifiers, node.declaration should be null

        // if there are specifiers, node.declaration should be null
        if (!node.declaration) {
          return;
        }

        const decl = node.declaration;
        if (isVariableDeclaration(decl)) {
          const declaration = decl.declarations[0];

          if (declaration == null) {
            return;
          }
          const { id } = declaration;
          if (isIdentifier(id)) {
            namedExports.push(id);
          }
        }
      },
      'Program:exit': function () {
        if (namedExports.length && !hasStoriesOfImport) {
          namedExports.forEach((n) => checkAndReportError(n, nonStoryExportsConfig));
        }
      },
    };
  },
});
