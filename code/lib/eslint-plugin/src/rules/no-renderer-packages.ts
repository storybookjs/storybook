/**
 * @file Do not import renderer packages directly in stories
 * @author Norbert De Langen
 */
import type { TSESTree } from '@typescript-eslint/utils';

import { CategoryId } from '../utils/constants';
import { createStorybookRule } from '../utils/create-storybook-rule';

type RendererPackage =
  | '@storybook/html'
  | '@storybook/preact'
  | '@storybook/react'
  | '@storybook/server'
  | '@storybook/svelte'
  | '@storybook/vue3'
  | '@storybook/web-components';

const rendererToFrameworks: Record<RendererPackage, string[]> = {
  '@storybook/html': ['@storybook/html-vite', '@storybook/html-webpack5'],
  '@storybook/preact': ['@storybook/preact-vite', '@storybook/preact-webpack5'],
  '@storybook/react': [
    '@storybook/nextjs',
    '@storybook/react-vite',
    '@storybook/nextjs-vite',
    '@storybook/react-webpack5',
    '@storybook/react-native-web-vite',
  ],
  '@storybook/server': ['@storybook/server-webpack5'],
  '@storybook/svelte': [
    '@storybook/svelte-vite',
    '@storybook/svelte-webpack5',
    '@storybook/sveltekit',
  ],
  '@storybook/vue3': ['@storybook/vue3-vite', '@storybook/vue3-webpack5'],
  '@storybook/web-components': [
    '@storybook/web-components-vite',
    '@storybook/web-components-webpack5',
  ],
};

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

type MessageIds = 'noRendererPackages';
type Options = readonly [];

export default createStorybookRule<Options, MessageIds>({
  name: 'no-renderer-packages',
  defaultOptions: [] as const,
  meta: {
    type: 'problem',
    severity: 'error',
    docs: {
      description: 'Do not import renderer packages directly in stories',
      categories: [CategoryId.RECOMMENDED],
    },
    schema: [],
    messages: {
      noRendererPackages:
        'Do not import renderer package "{{rendererPackage}}" directly. Use a framework package instead (e.g. {{suggestions}}).',
    },
  },

  create(context) {
    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        const packageName = node.source.value;

        if (typeof packageName === 'string' && packageName in rendererToFrameworks) {
          const suggestions = rendererToFrameworks[packageName as RendererPackage];

          context.report({
            node,
            messageId: 'noRendererPackages',
            data: {
              rendererPackage: packageName,
              suggestions: suggestions.join(', '),
            },
          });
        }
      },
    };
  },
});
