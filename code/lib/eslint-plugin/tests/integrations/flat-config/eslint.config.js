import plugin from 'eslint-plugin-storybook';

export default [
  ...plugin.configs['flat/recommended'],
  {
    files: ['**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)', '**/*.story.@(ts|tsx|js|jsx|mjs|cjs)'],
    rules: {
      'storybook/story-exports': 'warn',
      'storybook/meta-inline-properties': 'warn',
    },
  },
];
