/**
 * @file Story files should have a default export
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { dedent } from 'ts-dedent';

import ruleTester from '../test-utils';
import rule from './default-exports';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('default-exports', rule, {
  valid: [
    'export default { }',
    "export default { title: 'Button', component: Button }",
    "export default { title: 'Button', component: Button } as ComponentMeta<typeof Button>",
    `
      const meta = { title: 'Button', component: Button }
      export default meta
    `,
    `
    const meta: ComponentMeta<typeof Button> = { title: 'Button', component: Button }
    export default meta
    `,
    `
      import { config } from '#.storybook/preview'
      const meta = config.meta({})
    `,
    `
      import { storiesOf } from '@storybook/react'
      storiesOf('Component', module)
    `,
  ],

  invalid: [
    {
      code: 'export const Primary = () => <button>hello</button>',
      output: dedent`
        export default {}
        export const Primary = () => <button>hello</button>
      `,
      errors: [
        {
          messageId: 'shouldHaveDefaultExport',
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output: 'export default {}\nexport const Primary = () => <button>hello</button>',
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        import { MyComponent, Foo } from './MyComponent'
        export const Primary = () => <button>hello</button>
      `,
      output: dedent`
        import { MyComponent, Foo } from './MyComponent'
        export default { component: MyComponent }
        export const Primary = () => <button>hello</button>
      `,
      errors: [
        {
          messageId: 'shouldHaveDefaultExport',
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output:
                "import { MyComponent, Foo } from './MyComponent'\nexport default { component: MyComponent }\nexport const Primary = () => <button>hello</button>",
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        import MyComponent from './MyComponent'
        export const Primary = () => <button>hello</button>
      `,
      output: dedent`
        import MyComponent from './MyComponent'
        export default { component: MyComponent }
        export const Primary = () => <button>hello</button>
      `,
      errors: [
        {
          messageId: 'shouldHaveDefaultExport',
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output:
                "import MyComponent from './MyComponent'\nexport default { component: MyComponent }\nexport const Primary = () => <button>hello</button>",
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        import { MyComponentProps } from './MyComponent'
        export const Primary = () => <button>hello</button>
      `,
      output: dedent`
        import { MyComponentProps } from './MyComponent'
        export default {}
        export const Primary = () => <button>hello</button>
      `,
      errors: [
        {
          messageId: 'shouldHaveDefaultExport',
          suggestions: [
            {
              messageId: 'fixSuggestion',
              output:
                "import { MyComponentProps } from './MyComponent'\nexport default {}\nexport const Primary = () => <button>hello</button>",
            },
          ],
        },
      ],
    },
  ],
});
