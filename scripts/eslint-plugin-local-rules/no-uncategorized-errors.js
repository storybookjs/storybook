module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow usage of the Error JavaScript class.',
      category: 'Best Practices',
      recommended: true,
      url: 'https://github.com/storybookjs/storybook/blob/next/code/core/src/ERRORS.md',
    },
  },
  create(context) {
    return {
      NewExpression(node) {
        if (node.callee.name === 'Error') {
          context.report({
            node,
            message:
              'Avoid using a generic Error class. Use a categorized StorybookError class instead. See the docs 👉',
          });
        }
      },
    };
  },
};
