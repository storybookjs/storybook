/**
 * @file Meta should use `satisfies Meta`
 * @author Tiger Oakes
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import ruleTester from '../test-utils.ts';
import rule from './meta-satisfies-type.ts';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('meta-satisfies-type', rule, {
  valid: [
    "export default { title: 'Button', args: { primary: true } } satisfies Meta<typeof Button>",
    `const meta = {
      component: AccountForm,
    } satisfies Meta<typeof AccountForm>;
    export default meta;`,
    // CSF factories are typed by the factory itself, so `satisfies` has no place there
    `
      import preview from '../../.storybook/preview'
      const meta = preview.meta({ component: AccountForm })
    `,
  ],

  invalid: [
    {
      code: `export default { title: 'Button', args: { primary: true } }`,
      errors: [{ messageId: 'metaShouldSatisfyType' }],
    },
    {
      code: `
      const meta = {
        component: AccountForm,
      }
      export default meta;
    `,
      errors: [{ messageId: 'metaShouldSatisfyType' }],
    },
    {
      code: `
      const meta: Meta<typeof AccountForm> = {
        component: AccountForm,
      }
      export default meta;`,
      output: `
      const meta = {
        component: AccountForm,
      } satisfies Meta<typeof AccountForm>
      export default meta;`,
      errors: [{ messageId: 'metaShouldSatisfyType' }],
    },
    {
      code: `export default { title: 'Button', args: { primary: true } } as Meta<typeof Button>`,
      output: `export default { title: 'Button', args: { primary: true } } satisfies Meta<typeof Button>`,
      errors: [{ messageId: 'metaShouldSatisfyType' }],
    },
    {
      code: `
      const meta = ( {
        component: AccountForm,
      }) as (Meta<typeof AccountForm> )
      export default ( meta );`,
      output: `
      const meta = ( {
        component: AccountForm,
      }) satisfies (Meta<typeof AccountForm> )
      export default ( meta );`,
      errors: [{ messageId: 'metaShouldSatisfyType' }],
    },
  ],
});
