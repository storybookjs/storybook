/**
 * This exists because the code loading this uses `Cont = require(name)`.
 *
 * That code is in node_modules/../ some istanbul util file, which we cannot change.
 *
 * So we have to create a CJS file that requires the ESM file.
 *
 * The key compatibility that we're doing here, is the `.default` at the end.
 */
module.exports = require('@storybook/addon-vitest/internal/coverage-reporter').default;
