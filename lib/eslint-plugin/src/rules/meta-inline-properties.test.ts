/**
 * @file Meta should have inline properties
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { dedent } from 'ts-dedent';

import ruleTester from '../test-utils';
import rule from './meta-inline-properties';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('meta-inline-properties', rule, {
  valid: [
    "export default { title: 'Button', args: { primary: true } }",
    "export default { title: 'Button', args: { primary: true } } as ComponentMeta<typeof Button>",
  ],

  invalid: [
    {
      code: `
      const title = 'foo';
      const args = { a: 1 };
      export default { title, args };
    `,
      errors: [
        {
          messageId: 'metaShouldHaveInlineProperties',
          data: {
            property: 'title',
          },
          type: AST_NODE_TYPES.Property,
        },
        {
          messageId: 'metaShouldHaveInlineProperties',
          data: {
            property: 'args',
          },
          type: AST_NODE_TYPES.Property,
        },
      ],
    },
    {
      code: `
        export default { title: 'a' + 123 };
      `,
      errors: [
        {
          messageId: 'metaShouldHaveInlineProperties',
          data: {
            property: 'title',
          },
          type: AST_NODE_TYPES.Property,
        },
      ],
    },
    {
      code: `
        export default { title: \`a \${123}\` };
      `,
      errors: [
        {
          messageId: 'metaShouldHaveInlineProperties',
          data: {
            property: 'title',
          },
          type: AST_NODE_TYPES.Property,
        },
      ],
    },
    {
      code: `
        const title = 'a'

        export default {
          title,
          component: Badge,
        } as ComponentMeta<typeof Badge>
      `,
      errors: [
        {
          messageId: 'metaShouldHaveInlineProperties',
          data: {
            property: 'title',
          },
          type: AST_NODE_TYPES.Property,
        },
      ],
    },
    {
      code: `
        export default {
          title: someFunction(),
        }
      `,
      errors: [
        {
          messageId: 'metaShouldHaveInlineProperties',
          data: {
            property: 'title',
          },
          type: AST_NODE_TYPES.Property,
        },
      ],
    },
    {
      code: dedent`
        const title = 'a'

        const meta: ComponentMeta<typeof Badge> = {
          title,
          component: Badge,
        }

        export default meta
      `,
      errors: [
        {
          messageId: 'metaShouldHaveInlineProperties',
          data: {
            property: 'title',
          },
          type: AST_NODE_TYPES.Property,
        },
      ],
    },
  ],
});
