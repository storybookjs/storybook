## ESLint plugin local rules

This package serves as a local ESLint plugin to be used in the monorepo and help maintainers keep certain code standards.

### Rules

#### enforce-node-logger

Enforces the usage of logger from `node-logger` instead of `console.log` or `const logger = console`. This rule provides automatic fixes to:

- Replace `console.log()` calls with `logger.info()`
- Remove `const logger = console` assignments
- Automatically add `import { logger } from 'node-logger'` when needed
- **Why**: Promotes consistent logging across the codebase using Storybook's logger. The logger has log level and tracking capabilities, which is important for debugging purposes and keeps the user experience consistent as well.

#### no-uncategorized-errors

Disallows the usage of the generic JavaScript `Error` class. Instead, developers should use categorized StorybookError classes for better error handling and categorization.

- **What it catches**: `new Error()` expressions
- **Why**: Promotes consistent error handling across the codebase using Storybook's error categorization system
- **See**: [Storybook Error Documentation](https://github.com/storybookjs/storybook/blob/next/code/core/src/ERRORS.md)

#### no-duplicated-error-codes

Ensures that error codes are unique within each error category when extending `StorybookError`. This prevents conflicts and confusion in error handling.

- **What it catches**: Duplicate error codes within the same category in StorybookError subclasses
- **Why**: Maintains uniqueness of error codes for proper error identification and debugging
- **Example violation**: Two different error classes in the same category using the same error code

#### storybook-monorepo-imports

Ensures correct import paths for packages within the Storybook monorepo. Automatically fixes incorrect `@storybook/core` imports to use `storybook/internal` instead.

- **What it catches**: Imports from `@storybook/core/*` in packages where `storybook/internal` should be used
- **What it fixes**: Automatically replaces `@storybook/core` with `storybook/internal` and removes `/src` paths
- **Why**: Maintains consistent internal package imports across the monorepo

### Development

If you're fixing a rule or creating a new one, make sure to:

1. Make your code changes
2. Rerun yarn install in the `code` directory. It's necessary to update the module reference
3. Update the necessary `.eslintrc.js` files (if you are adding a new rule)
4. Restart the ESLint server in your IDE
