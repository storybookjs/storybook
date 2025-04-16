/*
 * IMPORTANT!
 * This file has been automatically generated,
 * in order to update its content, execute "pnpm run update-all"
 */
export = [
  {
    name: 'storybook:addon-interactions:setup',
    plugins: {
      get storybook() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('../../index')
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
]
