/**
 * @file Prefer pascal case
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { dedent } from 'ts-dedent';

import ruleTester from '../test-utils';
import rule from './prefer-pascal-case';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('prefer-pascal-case', rule, {
  valid: [
    'export const Primary = {}',
    `export const __namedExportsOrder = ['Secondary', 'Primary']`,
    `export const _primary = {}`,
    'export const Primary: Story = {}',
    `
      import { storiesOf } from '@storybook/react'
      export const links = []
      storiesOf('Component', module)
    `,
    `
      export default {
        title: 'MyComponent',
        component: MyComponent,
        includeStories: ['SimpleStory', 'ComplexStory'],
        excludeStories: /.*Data$/,
      };

      export const simpleData = { foo: 1, bar: 'baz' };
      export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

      export const SimpleStory = () => <MyComponent data={simpleData} />;
      export const ComplexStory = () => <MyComponent data={complexData} />;
    `,
    `
      export default {
        title: 'MyComponent',
        component: MyComponent,
        includeStories: [MyComponent.name],
      };

      export const SimpleStory = () => <MyComponent />;
    `,
  ],

  invalid: [
    {
      code: dedent`
        export const primary = {}
        primary.foo = 'bar'
      `,
      errors: [
        {
          messageId: 'usePascalCase',
          data: {
            name: 'primary',
          },
          type: AST_NODE_TYPES.Identifier,
          suggestions: [
            {
              messageId: 'convertToPascalCase',
              output: dedent`
                export const Primary = {}
                Primary.foo = 'bar'
              `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        export const primary: Story = {}
        primary.foo = 'bar'
      `,
      errors: [
        {
          messageId: 'usePascalCase',
          data: {
            name: 'primary',
          },
          type: AST_NODE_TYPES.Identifier,
          suggestions: [
            {
              messageId: 'convertToPascalCase',
              output: dedent`
                export const Primary: Story = {}
                Primary.foo = 'bar'
              `,
            },
          ],
        },
      ],
    },
    {
      code: dedent`
        export default {
          title: 'MyComponent',
          component: MyComponent,
          includeStories: /.*Story$/,
          excludeStories: /.*Data$/,
        };
        export const simpleData = { foo: 1, bar: 'baz' };
        export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };
        export const simpleStory = () => <MyComponent data={simpleData} />;
        simpleStory.args = {};
      `,
      errors: [
        {
          messageId: 'usePascalCase',
          data: {
            name: 'simpleStory',
          },
          type: AST_NODE_TYPES.Identifier,
          suggestions: [
            {
              messageId: 'convertToPascalCase',
              output: dedent`
                export default {
                  title: 'MyComponent',
                  component: MyComponent,
                  includeStories: /.*Story$/,
                  excludeStories: /.*Data$/,
                };
                export const simpleData = { foo: 1, bar: 'baz' };
                export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };
                export const SimpleStory = () => <MyComponent data={simpleData} />;
                SimpleStory.args = {};
              `,
            },
          ],
        },
      ],
    },
  ],
});
