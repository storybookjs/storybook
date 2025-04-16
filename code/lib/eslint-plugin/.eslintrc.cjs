'use strict';

module.exports = {
  extends: ['eslint:recommended'],
  overrides: [
    {
      files: ['tests/integrations/**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)'],
      rules: {
        'storybook/story-exports': 'warn',
        'storybook/meta-inline-properties': 'warn',
      },
    },
  ],
};
