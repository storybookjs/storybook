/**
 * @file Do not import renderer packages directly in stories
 * @author Norbert De Langen
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { dedent } from 'ts-dedent';

import ruleTester from '../test-utils';
import rule from './no-renderer-packages';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('no-renderer-packages', rule, {
  valid: [
    // Valid framework package imports
    dedent`
      import { something } from '@storybook/react-vite';
      
      export const MyStory = {
        // ...
      };
    `,
    dedent`
      import { something } from '@storybook/vue3-webpack5';
      
      export const MyStory = {
        // ...
      };
    `,
    dedent`
      import { something } from '@storybook/web-components-vite';
      
      export const MyStory = {
        // ...
      };
    `,
    // Non-storybook imports should be valid
    dedent`
      import React from 'react';
      import { something } from 'some-other-package';
      
      export const MyStory = {
        // ...
      };
    `,
  ],

  invalid: [
    {
      code: dedent`
        import { something } from '@storybook/react';
        
        export const MyStory = {
          // ...
        };
      `,
      errors: [
        {
          messageId: 'noRendererPackages',
          data: {
            rendererPackage: '@storybook/react',
            suggestions:
              '@storybook/nextjs, @storybook/react-vite, @storybook/nextjs-vite, @storybook/react-webpack5, @storybook/react-native-web-vite',
          },
          type: AST_NODE_TYPES.ImportDeclaration,
        },
      ],
    },
    {
      code: dedent`
        import { something } from '@storybook/vue3';
        
        export const MyStory = {
          // ...
        };
      `,
      errors: [
        {
          messageId: 'noRendererPackages',
          type: AST_NODE_TYPES.ImportDeclaration,
          data: {
            rendererPackage: '@storybook/vue3',
            suggestions: '@storybook/vue3-vite, @storybook/vue3-webpack5',
          },
        },
      ],
    },
    {
      code: dedent`
        import { something } from '@storybook/web-components';
        
        export const MyStory = {
          // ...
        };
      `,
      errors: [
        {
          messageId: 'noRendererPackages',
          type: AST_NODE_TYPES.ImportDeclaration,
          data: {
            rendererPackage: '@storybook/web-components',
            suggestions: '@storybook/web-components-vite, @storybook/web-components-webpack5',
          },
        },
      ],
    },
  ],
});
