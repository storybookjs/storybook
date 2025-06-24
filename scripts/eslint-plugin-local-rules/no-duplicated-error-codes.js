module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure unique error codes per category in the same file',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
  },
  create(context) {
    const errorClasses = {};

    // both code and category are passed as arguments to the StorybookError constructor's super call
    function findSuperArguments(node) {
      let superArguments = [];

      node.body.body.forEach((method) => {
        if (method.type === 'MethodDefinition' && method.kind === 'constructor') {
          method.value.body.body.forEach((expression) => {
            if (
              expression.type === 'ExpressionStatement' &&
              expression.expression.type === 'CallExpression' &&
              expression.expression.callee.type === 'Super'
            ) {
              superArguments = expression.expression.arguments;
            }
          });
        }
      });

      return superArguments;
    }

    return {
      ClassDeclaration(node) {
        if (node.superClass && node.superClass.name === 'StorybookError') {
          const superArguments = findSuperArguments(node);
          const properties = {
            category: null,
            code: null,
          };

          // Process the arguments to extract category and code
          superArguments.forEach((arg) => {
            if (arg.type === 'ObjectExpression') {
              arg.properties.forEach((property) => {
                if (Object.keys(properties).includes(property.key.name)) {
                  properties[property.key.name] = property;
                }
              });
            }
          });

          const categoryValue = properties.category.value.property.name;
          const codeValue = properties.code.value.value;

          if (categoryValue && codeValue) {
            if (!errorClasses[categoryValue]) {
              errorClasses[categoryValue] = new Set();
            }

            if (errorClasses[categoryValue].has(codeValue)) {
              context.report({
                node: properties.code.key,
                message: `Duplicate error code '${codeValue}' in category '${categoryValue}'.`,
              });
            } else {
              errorClasses[categoryValue].add(codeValue);
            }
          }
        }
      },
    };
  },
};
