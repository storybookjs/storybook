module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: "Use Storybook's node-logger instead of console",
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      replaceConsole: 'Replace console with logger from "storybook/internal/node-logger"',
      removeLoggerAssignment: 'Remove assignment of "logger = console" and use the Storybook logger instead',
    },
  },

  create(context) {
    let loggerImported = false;
    let importNode = null;

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'storybook/internal/node-logger') {
          importNode = node;
          loggerImported = node.specifiers.some(
            (s) => s.type === 'ImportSpecifier' && s.imported.name === 'logger'
          );
        }
      },

      VariableDeclarator(node) {
        if (node.id.name === 'logger' && node.init?.name === 'console') {
          context.report({
            node,
            messageId: 'removeLoggerAssignment',
            fix(fixer) {
              const fixes = [];

              const decl = node.parent; // VariableDeclaration
              const sourceCode = context.getSourceCode();

              if (decl.declarations.length === 1) {
                fixes.push(fixer.remove(decl));
              } else {
                const index = decl.declarations.indexOf(node);
                if (index === 0) {
                  const comma = sourceCode.getTokenAfter(node);
                  fixes.push(fixer.removeRange([node.range[0], comma.range[1]]));
                } else {
                  const comma = sourceCode.getTokenBefore(node);
                  fixes.push(fixer.removeRange([comma.range[0], node.range[1]]));
                }
              }

              if (!loggerImported) {
                if (importNode) {
                  const last = importNode.specifiers[importNode.specifiers.length - 1];
                  fixes.push(fixer.insertTextAfter(last, ', logger'));
                } else {
                  fixes.push(
                    fixer.insertTextBeforeRange(
                      [0, 0],
                      "import { logger } from 'storybook/internal/node-logger';\n"
                    )
                  );
                }
              }

              return fixes;
            },
          });
        }
      },

      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'console'
        ) {
          context.report({
            node,
            messageId: 'replaceConsole',
            fix(fixer) {
              const fixes = [];

              // Replace console.* with logger.*
              const method = node.callee.property.name;
              fixes.push(fixer.replaceText(node.callee, `logger.${method}`));

              // Add import if missing
              if (!loggerImported) {
                if (importNode) {
                  const last = importNode.specifiers[importNode.specifiers.length - 1];
                  fixes.push(fixer.insertTextAfter(last, ', logger'));
                } else {
                  fixes.push(
                    fixer.insertTextBeforeRange(
                      [0, 0],
                      "import { logger } from 'storybook/internal/node-logger';\n"
                    )
                  );
                }
              }

              return fixes;
            },
          });
        }
      },
    };
  },
};
