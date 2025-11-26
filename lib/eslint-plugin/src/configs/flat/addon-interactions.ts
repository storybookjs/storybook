import storybookPlugin from '../../index';

/*
 * IMPORTANT!
 * This file has been automatically generated,
 * in order to update its content, execute "yarn update-rules" or rebuild this package.
 */
export default [
  {
    name: 'storybook:addon-interactions:setup',
    plugins: {
      get storybook() {
        // this getter could just be a direct import, but we need to use a getter to avoid circular references in the types
        return storybookPlugin;
      },
    },
  },
  {
    name: 'storybook:addon-interactions:stories-rules',
    files: ['**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)', '**/*.story.@(ts|tsx|js|jsx|mjs|cjs)'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'import/no-anonymous-default-export': 'off',
      'storybook/await-interactions': 'error',
      'storybook/context-in-play-function': 'error',
      'storybook/use-storybook-expect': 'error',
      'storybook/use-storybook-testing-library': 'error',
    } as const,
  },
  {
    name: 'storybook:addon-interactions:main-rules',
    files: ['.storybook/main.@(js|cjs|mjs|ts)'],
    rules: {
      'storybook/no-uninstalled-addons': 'error',
    } as const,
  },
];
