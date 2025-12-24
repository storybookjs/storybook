import storybookPlugin from '../../index';

/*
 * IMPORTANT!
 * This file has been automatically generated,
 * in order to update its content, execute "yarn update-rules" or rebuild this package.
 */
export default [
  {
    name: 'storybook:csf:setup',
    plugins: {
      get storybook() {
        // this getter could just be a direct import, but we need to use a getter to avoid circular references in the types
        return storybookPlugin;
      },
    },
  },
  {
    name: 'storybook:csf:stories-rules',
    files: ['**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)', '**/*.story.@(ts|tsx|js|jsx|mjs|cjs)'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'import-x/no-anonymous-default-export': 'off',
      'storybook/csf-component': 'warn',
      'storybook/default-exports': 'error',
      'storybook/hierarchy-separator': 'warn',
      'storybook/no-redundant-story-name': 'warn',
      'storybook/story-exports': 'error',
    } as const,
  },
  {
    name: 'storybook:csf:main-rules',
    files: ['.storybook/main.@(js|cjs|mjs|ts)'],
    rules: {
      'storybook/no-uninstalled-addons': 'error',
    } as const,
  },
];
