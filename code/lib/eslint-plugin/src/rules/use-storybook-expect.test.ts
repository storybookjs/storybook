/**
 * @file Use expect from '@storybook/jest'
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { dedent } from 'ts-dedent';

import ruleTester from '../test-utils';
import rule from './use-storybook-expect';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('use-storybook-expect', rule, {
  valid: [
    dedent`
      import { expect } from '@storybook/jest';

      Default.play = () => {
        expect(123).toEqual(123);
      }
    `,
    dedent`
      import { expect } from '@storybook/jest';

      export const Basic = {
        ...Default,
        play: async (context) => {
          expect(123).toEqual(123);
        },
      };
    `,
    dedent`
      import { expect } from '@storybook/test';

      Default.play = () => {
        expect(123).toEqual(123);
      }
    `,
    dedent`
      import { expect } from '@storybook/test';

      export const Basic = {
        ...Default,
        play: async (context) => {
          expect(123).toEqual(123);
        },
      };
    `,
    dedent`
      import { expect } from 'storybook/test';

      Default.play = () => {
        expect(123).toEqual(123);
      }
    `,
  ],

  invalid: [
    {
      code: dedent`
        Default.play = () => {
          expect(123).toEqual(123);
        }
      `,
      errors: [
        {
          messageId: 'useExpectFromStorybook',
          type: AST_NODE_TYPES.Identifier,
        },
      ],
    },
    {
      code: dedent`
        const someInteraction = () => {
          expect(123).toEqual(123);
        }
        Default.play = someInteraction
      `,
      errors: [
        {
          messageId: 'useExpectFromStorybook',
          type: AST_NODE_TYPES.Identifier,
        },
      ],
    },
    {
      code: dedent`
        export const Basic = {
          ...Default,
          play: async (context) => {
            expect(123).toEqual(123);
          },
        };
      `,
      errors: [
        {
          messageId: 'useExpectFromStorybook',
          type: AST_NODE_TYPES.Identifier,
        },
      ],
    },
  ],
});
