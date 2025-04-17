/**
 * @file Component property should be set
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import ruleTester from '../test-utils';
import rule from './csf-component';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('csf-component', rule, {
  valid: [
    "export default { title: 'Button', component: Button }",
    "export default { title: 'Button', component: Button } as ComponentMeta<typeof Button>",
  ],

  invalid: [
    {
      code: "export default { title: 'Button' }",
      errors: [
        {
          messageId: 'missingComponentProperty',
          type: AST_NODE_TYPES.ExportDefaultDeclaration,
        },
      ],
    },
    {
      code: "export default { title: 'Button' } as ComponentMeta<typeof Button>",
      errors: [
        {
          messageId: 'missingComponentProperty',
          type: AST_NODE_TYPES.ExportDefaultDeclaration,
        },
      ],
    },
    {
      code: `
        const meta = { title: 'Button' } as Meta<typeof Button>
        export default meta
      `,
      errors: [
        {
          messageId: 'missingComponentProperty',
          type: AST_NODE_TYPES.ExportDefaultDeclaration,
        },
      ],
    },
  ],
});
