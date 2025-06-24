## ESLint plugin local rules

This package serves as a local ESLint plugin to be used in the monorepo and help maintainers keep certain code standards.

### Development

If you're fixing a rule or creating a new one, make sure to:

1. Make your code changes
2. Rerun yarn install in the `code` directory. It's necessary to update the module reference
3. Update the necessary `.eslintrc.js` files (if you are adding a new rule)
4. Restart the ESLint server in your IDE
