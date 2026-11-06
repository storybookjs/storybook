/*
 * IMPORTANT!
 * This file has been automatically generated,
 * in order to update its content, execute "yarn update-rules" or rebuild this package.
 */
import type { CompatibleFlatConfig } from '../../types/index.ts';

import baseConfig from './csf.ts';

const config: CompatibleFlatConfig[] = [
  ...baseConfig,
  {
    name: 'storybook:csf-strict:rules',
    files: ['**/*.stories.@(ts|tsx|js|jsx|mjs|cjs)', '**/*.story.@(ts|tsx|js|jsx|mjs|cjs)'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'import-x/no-anonymous-default-export': 'off',
      'storybook/no-stories-of': 'error',
      'storybook/no-title-property-in-meta': 'error',
    } as const,
  },
];

export default config;
