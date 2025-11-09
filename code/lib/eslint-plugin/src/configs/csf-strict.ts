/*
 * IMPORTANT!
 * This file has been automatically generated,
 * in order to update its content, execute "yarn update-rules" or rebuild this package.
 */
export default {
  // This file is bundled in an index.js file at the root
  // so the reference is relative to the src directory
  extends: './configs/csf',
  overrides: [
    {
      files: ['**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)', '**/*.story.@(ts|tsx|js|jsx|mjs|cjs)'],
      rules: {
        'react-hooks/rules-of-hooks': 'off',
        'import/no-anonymous-default-export': 'off',
        'storybook/no-stories-of': 'error',
        'storybook/no-title-property-in-meta': 'error',
      } as const,
    },
  ],
};
