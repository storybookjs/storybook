/** @file Enforce CSF3 format for stories */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import dedent from 'ts-dedent';

import ruleTester from '../test-utils';
import rule from './only-csf3';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('only-csf3', rule, {
  valid: [
    // Simple CSF3 story
    'export const Primary = {}',

    // CSF3 with args only (uses default render)
    dedent`
      export const Primary = {
        args: {
          primary: true,
          label: 'Button',
        },
      }
    `,

    // CSF3 with render function only
    dedent`
      export const Secondary = {
        render: (args) => <Button {...args} />,
      }
    `,

    // CSF3 with both render and args
    dedent`
      export const Tertiary = {
        render: (args) => <Button {...args} />,
        args: {
          label: 'Tertiary',
        },
      }
    `,

    // CSF3 meta export
    dedent`
      export default {
        title: 'Button',
        component: Button,
        tags: ['autodocs'],
      } satisfies Meta<typeof Button>
    `,

    // CSF3 with play function
    dedent`
      export const WithInteractions = {
        play: async ({ canvasElement }) => {
          await userEvent.click(canvasElement.querySelector('button'))
        }
      }
    `,

    // Non-story exports should be ignored
    dedent`
      export const data = { foo: 'bar' }
      export const utils = { format: () => {} }
    `,

    // Re-exports should be ignored
    dedent`
      export { Button } from './Button'
      export * from './types'
    `,

    // Default export without CSF2 patterns
    dedent`
      export default function MyComponent() {
        return <div>Hello</div>
      }
    `,
  ],

  invalid: [
    // CSF2: Template.bind({}) with args
    {
      code: dedent`
        const Template = (args) => <Button {...args} />
        export const Primary = Template.bind({})
        Primary.args = { label: 'Button' }
      `,
      output: dedent`
        const Template = (args) => <Button {...args} />
        export const Primary = {
          render: Template,
          args: { label: 'Button' },
        }
      `,
      errors: [
        {
          messageId: 'noCSF2Format',
          data: {
            storyName: 'Primary',
            pattern: 'template bind',
          },
          type: AST_NODE_TYPES.CallExpression,
        },
      ],
    },

    // CSF2: Function declaration
    {
      code: dedent`
        export function Secondary(args) {
          return <Button {...args} />
        }
      `,
      output: dedent`
        export const Secondary = {
          render: function(args) {
            return <Button {...args} />
          },
        }
      `,
      errors: [
        {
          messageId: 'noCSF2Format',
          data: {
            storyName: 'Secondary',
            pattern: 'function declaration',
          },
          type: AST_NODE_TYPES.FunctionDeclaration,
        },
      ],
    },

    // CSF2: Function expression
    {
      code: dedent`
        export const Secondary = function(args) {
          return <Button {...args}>Click me</Button>
        }
      `,
      output: dedent`
        export const Secondary = {
          render: function(args) {
            return <Button {...args}>Click me</Button>
          },
        }
      `,
      errors: [
        {
          messageId: 'noCSF2Format',
          data: {
            storyName: 'Secondary',
            pattern: 'function expression',
          },
          type: AST_NODE_TYPES.FunctionExpression,
        },
      ],
    },

    // CSF2: Mixed with CSF3 (should detect both)
    {
      code: dedent`
        export const Valid = {
          args: { label: 'Valid' },
        }
        export function Invalid(args) {
          return <Button {...args} />
        }
      `,
      output: dedent`
        export const Valid = {
          args: { label: 'Valid' },
        }
        export const Invalid = {
          render: function(args) {
            return <Button {...args} />
          },
        }
      `,
      errors: [
        {
          messageId: 'noCSF2Format',
          data: {
            storyName: 'Invalid',
            pattern: 'function declaration',
          },
          type: AST_NODE_TYPES.FunctionDeclaration,
        },
      ],
    },

    // CSF2: Property assignment mixed with CSF3
    {
      code: dedent`
        export const Primary = {}
        Primary.parameters = { foo: 'bar' }
      `,
      output: dedent`
        export const Primary = {
          parameters: { foo: 'bar' },
        }
      `,
      errors: [
        {
          messageId: 'noCSF2Format',
          data: {
            storyName: 'Primary',
            pattern: 'property assignment (.parameters)',
          },
          type: AST_NODE_TYPES.AssignmentExpression,
        },
      ],
    },

    // CSF2: Complex story with multiple properties - preserves assignment order(render always first)
    {
      code: dedent`
        export const Complex = Template.bind({})
        Complex.args = { label: 'Complex' }
        Complex.parameters = { layout: 'centered' }
        Complex.decorators = [withActions]
        Complex.play = async () => { /* test interactions */ }
      `,
      output: dedent`
        export const Complex = {
          render: Template,
          args: { label: 'Complex' },
          parameters: { layout: 'centered' },
          decorators: [withActions],
          play: async () => { /* test interactions */ },
        }
      `,
      errors: [
        {
          messageId: 'noCSF2Format',
          data: {
            storyName: 'Complex',
            pattern: 'template bind',
          },
          type: AST_NODE_TYPES.CallExpression,
        },
      ],
    },
  ],
});
