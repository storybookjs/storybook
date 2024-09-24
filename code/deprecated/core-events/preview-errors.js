// This is required for compatibility in projects that don't support the exports map field (e.g. Jest 27),
// so when require paths such as `@storybook/core-events/preview-errors`,
// An error like this will occur:
// ENOENT: no such file or directory, open '/xyz/node_modules/@storybook/core-events/preview-errors.js'
// https://github.com/storybookjs/storybook/pull/24038#issuecomment-1704684432
module.exports = require('storybook/internal/preview-errors');
