/*
 * IMPORTANT!
 * This file has been automatically generated,
 * in order to update its content, execute "yarn update-rules" or rebuild this package.
 */
export default {
  plugins: ['storybook'],
  overrides: [
    {
      files: ['**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)', '**/*.story.@(ts|tsx|js|jsx|mjs|cjs)'],
      rules: {
        'react-hooks/rules-of-hooks': 'off',
        'import/no-anonymous-default-export': 'off',
        'storybook/await-interactions': 'error',
        'storybook/context-in-play-function': 'error',
        'storybook/default-exports': 'error',
        'storybook/hierarchy-separator': 'warn',
        'storybook/no-redundant-story-name': 'warn',
        'storybook/no-renderer-packages': 'error',
        'storybook/prefer-pascal-case': 'warn',
        'storybook/story-exports': 'error',
        'storybook/use-storybook-expect': 'error',
        'storybook/use-storybook-testing-library': 'error',
      } as const,
    },
    {
      files: ['.storybook/main.@(js|cjs|mjs|ts)'],
      rules: {
        'storybook/no-uninstalled-addons': 'error',
      } as const,
    },
  ],
};
