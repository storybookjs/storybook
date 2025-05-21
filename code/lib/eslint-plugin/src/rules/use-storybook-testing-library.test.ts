/**
 * @file Do not testing library directly on stories
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import ruleTester from '../test-utils';
import rule from './use-storybook-testing-library';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('use-storybook-testing-library', rule, {
  valid: ["import { within } from '@storybook/testing-library'"],

  invalid: [
    {
      code: "import { within } from '@testing-library/dom'",
      output: "import { within } from '@storybook/testing-library'",
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
              output: "import { within } from '@storybook/testing-library'",
            },
          ],
        },
      ],
    },
    {
      code: "import userEvent from '@testing-library/user-event'",
      output: "import { userEvent } from '@storybook/testing-library'",
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
              output: "import { userEvent } from '@storybook/testing-library'",
            },
          ],
        },
      ],
    },
    {
      code: "import userEvent, { foo, bar as Bar } from '@testing-library/user-event'",
      output: "import { userEvent, foo, bar as Bar } from '@storybook/testing-library'",
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
              output: "import { userEvent, foo, bar as Bar } from '@storybook/testing-library'",
            },
          ],
        },
      ],
    },
  ],
});
