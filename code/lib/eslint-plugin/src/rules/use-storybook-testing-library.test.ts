/**
 * @file Do not testing library directly on stories
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import ruleTester from '../test-utils.ts';
import rule from './use-storybook-testing-library.ts';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('use-storybook-testing-library', rule, {
  valid: ["import { within } from 'storybook/test'"],

  invalid: [
    {
      code: "import { within } from '@testing-library/dom'",
      output: "import { within } from 'storybook/test'",
      errors: [
        {
          messageId: 'dontUseTestingLibraryDirectly',
          data: {
            library: '@testing-library/dom',
          },
          type: AST_NODE_TYPES.ImportDeclaration,
          suggestions: [
            {
              messageId: 'updateImports',
              output: "import { within } from 'storybook/test'",
            },
          ],
        },
      ],
    },
    {
      code: "import userEvent from '@testing-library/user-event'",
      output: "import { userEvent } from 'storybook/test'",
      errors: [
        {
          messageId: 'dontUseTestingLibraryDirectly',
          data: {
            library: '@testing-library/user-event',
          },
          type: AST_NODE_TYPES.ImportDeclaration,
          suggestions: [
            {
              messageId: 'updateImports',
              output: "import { userEvent } from 'storybook/test'",
            },
          ],
        },
      ],
    },
    {
      code: "import userEvent, { foo, bar as Bar } from '@testing-library/user-event'",
      output: "import { userEvent, foo, bar as Bar } from 'storybook/test'",
      errors: [
        {
          messageId: 'dontUseTestingLibraryDirectly',
          data: {
            library: '@testing-library/user-event',
          },
          type: AST_NODE_TYPES.ImportDeclaration,
          suggestions: [
            {
              messageId: 'updateImports',
              output: "import { userEvent, foo, bar as Bar } from 'storybook/test'",
            },
          ],
        },
      ],
    },
  ],
});
