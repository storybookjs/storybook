// @ts-nocheck

// Node fields that TypeScript 7.1's native AST has and the compiler API's AST does not.
const NATIVE_ONLY_FIELDS = new Set(['defaultType', 'nameExpression', 'postfixToken']);

const fieldName = (node) => {
  if (node.type === 'Identifier') {
    return node.name;
  }
  return node.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
};

module.exports = {
  meta: {
    type: /** @type {const} */ ('problem'),
    docs: {
      description:
        'Disallow reading AST node fields that only TypeScript 7.1 has in component-meta docgen',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://github.com/storybookjs/storybook/blob/next/code/lib/component-meta-typescript/src/docgen-typescript.ts',
    },
    messages: {
      nativeOnly:
        '`{{name}}` is a TypeScript 7.1 node field. Read it through a node accessor of `DocgenTypeScript` in @storybook/component-meta-typescript, so the code for each TypeScript stays in its backend.',
    },
    schema: [],
  },
  create(context) {
    const check = (node, key) => {
      const name = key && fieldName(key);
      if (NATIVE_ONLY_FIELDS.has(name)) {
        context.report({ node, messageId: 'nativeOnly', data: { name } });
      }
    };
    return {
      MemberExpression(node) {
        check(node, node.property);
      },
      BinaryExpression(node) {
        if (node.operator === 'in') {
          check(node, node.left);
        }
      },
      ObjectPattern(node) {
        for (const property of node.properties) {
          if (property.type === 'Property') {
            check(property, property.key);
          }
        }
      },
    };
  },
};
