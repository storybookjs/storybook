/**
 * @file A story file must contain at least one story export
 * @author Yann Braga
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { dedent } from 'ts-dedent';

import ruleTester from '../test-utils';
import rule from './story-exports';

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('story-exports', rule, {
  valid: [
    'export const Primary = {}',
    dedent`
      export default {}
      export const Primary = {}
    `,
    dedent`
      export default {} as ComponentMeta<typeof RestaurantDetailPage>
      export const Primary = {}
    `,
    dedent`
      import { storiesOf } from '@storybook/react'
      storiesOf('MyComponent', module)
    `,
    dedent`
      const Primary = {}
      const Secondary = {}
      export default {}
      export { Primary, Secondary }
    `,
    `
      export default {
        title: 'MyComponent',
        component: MyComponent,
        includeStories: [MyComponent.name],
      };

      export const SimpleStory = () => <MyComponent />;
    `,
    dedent`
      export default {
        excludeStories: /.*Data$/,
      }

      const mockData = {}
      const Primary = {}

      export { mockData, Primary }
    `,
    'export function Primary() {}',
    dedent`
      export default {}
      export function Primary() {}
    `,
    dedent`
      export default {} as ComponentMeta<typeof RestaurantDetailPage>
      export function Primary() {}
    `,
  ],
  invalid: [
    {
      code: dedent`
        export default {
          component: Button
        } as ComponentMeta<typeof RestaurantDetailPage>`,
      // output: dedent`
      //   export default {
      //     component: Button
      //   } as ComponentMeta<typeof RestaurantDetailPage>

      //   export const Default = {}
      // `,
      errors: [
        {
          messageId: 'shouldHaveStoryExport',
        },
      ],
    },
    {
      code: dedent`
        export default {
          excludeStories: /.*Data$/,
        }

        export const mockData = {}
      `,
      // output: dedent`
      //   export default {
      //     excludeStories: /.*Data$/,
      //   }

      //   export const mockData = {}

      //   export const Default = {}
      // `,
      errors: [
        {
          messageId: 'shouldHaveStoryExportWithFilters',
        },
      ],
    },
    {
      code: dedent`
        export default {
          excludeStories: /.*Data$/,
        }

        const mockData = {}
        const Primary = {}

        export { mockData }
      `,
      // output: dedent`
      //   export default {
      //     excludeStories: /.*Data$/,
      //   }

      //   const mockData = {}
      //   const Primary = {}

      //   export { mockData }

      //   export const Default = {}
      // `,
      errors: [
        {
          messageId: 'shouldHaveStoryExportWithFilters',
        },
      ],
    },
    {
      code: dedent`
        export default {
          excludeStories: /.*Data$/,
        }

        export function generateMockData() {}
      `,
      // output: dedent`
      //   export default {
      //     excludeStories: /.*Data$/,
      //   }

      //   export function generateMockData() {}

      //   export const Default = {}
      // `,
      errors: [
        {
          messageId: 'shouldHaveStoryExportWithFilters',
        },
      ],
    },
  ],
});
