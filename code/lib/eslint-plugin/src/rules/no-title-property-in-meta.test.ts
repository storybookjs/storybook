/**
 * @file No title property in meta
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { dedent } from 'ts-dedent';

import ruleTester from '../test-utils';
import rule from './no-title-property-in-meta';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('no-title-property-in-meta', rule, {
  valid: [
    'export default {  }',
    'export default { component: Button }',
    'export default { component: Button } as ComponentMeta<typeof Button>',
    'export default { component: Button } as Meta<typeof Button>',
    'export default { component: Button } satisfies Meta<typeof Button>',
    'export default { ...props }',
    // CSF4 factory pattern: meta is a function call result, not an object literal
    // getMetaObjectExpression() returns null for CallExpressions, so the rule skips it
    dedent`
      const meta = preview.meta({ component: Button, title: 'Button' })
      export default meta
    `,
    {
      code: dedent`
        const meta = preview.type<{ args: { theme: string } }>().meta({ component: Button, title: 'Button' })
        export default meta
      `,
      filename: 'MyComponent.stories.ts',
    },
  ],

  invalid: [
    {
      code: "export default { title: 'Button', component: Button }",
      errors: [
        {
          messageId: 'noTitleInMeta',
          type: AST_NODE_TYPES.Property,
          suggestions: [
            {
              messageId: 'removeTitleInMeta',
              output: 'export default {  component: Button }',
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        const meta = { component: Button, title: 'Button' }
        export default meta
      `,
      errors: [
        {
          messageId: 'noTitleInMeta',
          type: AST_NODE_TYPES.Property,
          suggestions: [
            {
              messageId: 'removeTitleInMeta',
              output: dedent`
                const meta = { component: Button,  }
                export default meta
              `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        const meta = { component: Button, title: 'Button' } as Meta<typeof Button>
        export default meta
      `,
      errors: [
        {
          messageId: 'noTitleInMeta',
          type: AST_NODE_TYPES.Property,
          suggestions: [
            {
              messageId: 'removeTitleInMeta',
              output: dedent`
                const meta = { component: Button,  } as Meta<typeof Button>
                export default meta
              `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        const meta = { component: Button, title: 'Button' } satisfies Meta<typeof Button>
        export default meta
      `,
      errors: [
        {
          messageId: 'noTitleInMeta',
          type: AST_NODE_TYPES.Property,
          suggestions: [
            {
              messageId: 'removeTitleInMeta',
              output: dedent`
                const meta = { component: Button,  } satisfies Meta<typeof Button>
                export default meta
              `,
            },
          ],
        },
      ],
    },
  ],
});
