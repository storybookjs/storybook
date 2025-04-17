/**
 * @file Deprecated hierarchy separator
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { dedent } from 'ts-dedent';

import ruleTester from '../test-utils';
import rule from './hierarchy-separator';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('hierarchy-separator', rule, {
  valid: [
    'export default {  }',
    "export default { title: 'Examples.Components' }",
    "export default { title: 'Examples/Components/Button' }",
    "export default { title: 'Examples/Components/Button' } as ComponentMeta<typeof Button>",
    "export default { title: 'Examples.Components' } satisfies Meta<typeof Button>",
    'export default { ...props } as ComponentMeta<typeof Button>',
  ],

  invalid: [
    {
      code: "export default { title: 'Examples|Components/Button' }",
      output: "export default { title: 'Examples/Components/Button' }",
      errors: [
        {
          type: AST_NODE_TYPES.Property,
          messageId: 'deprecatedHierarchySeparator',
          suggestions: [
            {
              messageId: 'useCorrectSeparators',
              output: "export default { title: 'Examples/Components/Button' }",
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        const meta = { title: 'Examples|Components/Button' }
        export default meta
      `,
      output: dedent`
        const meta = { title: 'Examples/Components/Button' }
        export default meta
      `,
      errors: [
        {
          type: AST_NODE_TYPES.Property,
          messageId: 'deprecatedHierarchySeparator',
          suggestions: [
            {
              messageId: 'useCorrectSeparators',
              output: dedent`
                const meta = { title: 'Examples/Components/Button' }
                export default meta
              `,
            },
          ],
        },
      ],
    },
  ],
});
