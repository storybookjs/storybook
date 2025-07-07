/**
 * @file Enforce CSF3 format for stories.
 * @see https://storybook.js.org/blog/component-story-format-3-0/
 */
import type { TSESTree } from '@typescript-eslint/utils';

import { isIdentifier } from '../utils/ast';
import { createStorybookRule } from '../utils/create-storybook-rule';

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export = createStorybookRule({
  name: 'only-csf3',
  defaultOptions: [],
  meta: {
    type: 'problem',
    severity: 'error',
    docs: {
      description: 'Enforce Component Story Format 3.0 (CSF3) for stories',
      excludeFromConfig: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      noCSF2Format: 'Story "{{storyName}}" uses CSF2 {{pattern}}. Please migrate to CSF3.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const textCache = new Map<TSESTree.Node, string>();
    const storyNodes = new Map<string, StoryInfo>();

    // Types
    interface StoryInfo {
      node: TSESTree.Node;
      exportNode?: TSESTree.Node;
      assignments: Assignment[];
      isTemplateBind: boolean;
      reported: boolean;
    }

    interface PropertyAssignment {
      type: 'property';
      property: string;
      value: TSESTree.Expression;
      node: TSESTree.AssignmentExpression;
    }

    interface RenderAssignment {
      type: 'render';
      property: 'render';
      value: TSESTree.Identifier;
      templateNode: TSESTree.CallExpression;
    }

    type Assignment = PropertyAssignment | RenderAssignment;

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    const isStoryName = (name: string): boolean => {
      // Fastest way to check uppercase first character
      const firstChar = name.charCodeAt(0);
      return firstChar >= 65 && firstChar <= 90;
    };

    const isTemplateBind = (node: TSESTree.Node): node is TSESTree.CallExpression => {
      return (
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'bind'
      );
    };

    const getNodeText = (node: TSESTree.Node): string => {
      let cached = textCache.get(node);
      if (!cached) {
        cached = sourceCode.getText(node);
        textCache.set(node, cached);
      }
      return cached;
    };

    const createCSF3Object = (story: StoryInfo): string => {
      if (story.assignments.length === 0) {
        return '{}';
      }

      let assignments = [...story.assignments];

      // Handle Template.bind() case - add render property
      if (story.isTemplateBind && story.node.type === 'CallExpression') {
        const callExpr = story.node;
        if (
          callExpr.callee.type === 'MemberExpression' &&
          callExpr.callee.object.type === 'Identifier'
        ) {
          const template = callExpr.callee.object;
          assignments = assignments.filter((a) => a.property !== 'render');
          assignments.unshift({
            type: 'render',
            property: 'render',
            value: template,
            templateNode: callExpr,
          });
        }
      }

      // Sort properties: render first
      const renderIdx = assignments.findIndex((a) => a.property === 'render');
      if (renderIdx > 0) {
        const render = assignments[renderIdx];
        if (render) {
          assignments.splice(renderIdx, 1);
          assignments.unshift(render);
        }
      } else if (renderIdx === -1) {
        assignments.sort((a, b) => a.property.localeCompare(b.property));
      }

      // Format as multi-line for readability when multiple properties
      if (assignments.length > 1) {
        const props = assignments.map((a) => `  ${a.property}: ${getNodeText(a.value)},`);
        return `{\n${props.join('\n')}\n}`;
      } else {
        const prop = assignments[0];
        if (!prop) {
          return '{}';
        }
        return `{\n  ${prop.property}: ${getNodeText(prop.value)},\n}`;
      }
    };

    const createFunctionCSF3 = (
      name: string,
      func:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
    ): string => {
      const params = func.params.map((p) => getNodeText(p)).join(', ');

      // For arrow functions without block statement, wrap in block
      if (func.body.type !== 'BlockStatement') {
        const expr = getNodeText(func.body);
        return `export const ${name} = {\n  render: function(${params}) {\n    return ${expr}\n  },\n}`;
      }

      // For block statements, extract content and add proper indentation
      const bodyText = getNodeText(func.body);
      const bodyLines = bodyText.slice(1, -1).split('\n'); // Remove outer braces

      // Process each line to add indentation, filtering out empty lines
      const indentedLines = bodyLines
        .map((line) => line.trim())
        .filter((line) => line.length > 0) // Remove empty lines
        .map((line) => `    ${line}`);

      // Join lines
      const bodyContent = indentedLines.join('\n');

      return `export const ${name} = {\n  render: function(${params}) {\n${bodyContent}\n  },\n}`;
    };

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    return {
      ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration): void {
        const decl = node.declaration;
        if (!decl) {
          return;
        }

        // Function declarations
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          const name = decl.id.name;
          if (!isStoryName(name)) {
            return;
          }

          context.report({
            node: decl,
            messageId: 'noCSF2Format',
            data: { storyName: name, pattern: 'function declaration' },
            fix: (fixer) => fixer.replaceText(node, createFunctionCSF3(name, decl)),
          });
          return;
        }

        // Variable declarations
        if (decl.type === 'VariableDeclaration') {
          const [declarator] = decl.declarations;
          if (!declarator?.id || !isIdentifier(declarator.id) || !declarator.init) {
            return;
          }

          const name = declarator.id.name;
          if (!isStoryName(name)) {
            return;
          }

          const init = declarator.init;
          const isFuncExpr =
            init.type === 'FunctionExpression' || init.type === 'ArrowFunctionExpression';
          const isObjExpr = init.type === 'ObjectExpression';
          const isTemplBind = isTemplateBind(init);

          // Function expressions
          if (isFuncExpr) {
            const funcExpr = init as TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
            context.report({
              node: init,
              messageId: 'noCSF2Format',
              data: { storyName: name, pattern: 'function expression' },
              fix: (fixer) => fixer.replaceText(node, createFunctionCSF3(name, funcExpr)),
            });
            return;
          }

          // Track for later processing
          if (isObjExpr || isTemplBind) {
            let hasProps = false;
            if (isObjExpr && init.type === 'ObjectExpression') {
              hasProps = init.properties.length > 0;
            }

            if (isTemplBind || !hasProps) {
              storyNodes.set(name, {
                node: init,
                exportNode: node,
                assignments: [],
                isTemplateBind: isTemplBind,
                reported: false,
              });
            }
          }
        }
      },

      AssignmentExpression(node: TSESTree.AssignmentExpression): void {
        if (
          node.left.type !== 'MemberExpression' ||
          !isIdentifier(node.left.object) ||
          !isIdentifier(node.left.property)
        ) {
          return;
        }

        const name = node.left.object.name;
        if (!isStoryName(name)) {
          return;
        }

        const story = storyNodes.get(name);
        if (story) {
          story.assignments.push({
            type: 'property',
            property: node.left.property.name,
            value: node.right,
            node,
          });
          story.reported = false;
        }
      },

      'Program:exit'(): void {
        for (const [name, story] of storyNodes) {
          if (story.reported || (!story.isTemplateBind && story.assignments.length === 0)) {
            continue;
          }

          const lastAssign = story.assignments[story.assignments.length - 1];
          const reportNode = story.isTemplateBind
            ? story.node
            : lastAssign?.type === 'property'
              ? lastAssign.node
              : story.node;

          context.report({
            node: reportNode,
            messageId: 'noCSF2Format',
            data: {
              storyName: name,
              pattern: story.isTemplateBind
                ? 'template bind'
                : `property assignment (.${lastAssign?.property})`,
            },
            fix: (fixer) => {
              const startNode = story.exportNode || story.node;
              const endNode = lastAssign?.type === 'property' ? lastAssign.node : story.node;
              const csf3Code = createCSF3Object(story);

              if (!startNode.range || !endNode.range) {
                return null;
              }

              return fixer.replaceTextRange(
                [startNode.range[0], endNode.range[1]],
                `export const ${name} = ${csf3Code}`
              );
            },
          });
          story.reported = true;
        }
      },
    };
  },
});
