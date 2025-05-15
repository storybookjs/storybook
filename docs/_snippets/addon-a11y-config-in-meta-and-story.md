```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {},
      /*
       * Axe's configuration
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#api-name-axeconfigure
       * to learn more about the available properties.
       */
      config: {},
      /*
       * Axe's options parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter
       * to learn more about the available options.
       */
      options: {},
      /*
       * Configure test behavior
       * See: https://storybook.js.org/docs/next/writing-tests/accessibility-testing#test-behavior
       */
      test: 'error',
    },
  },
  globals: {
    a11y: {
      // Optional flag to prevent the automatic check
      manual: true,
    },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const ExampleStory: Story = {
  parameters: {
    a11y: {
      // ...same config available as above
    },
  },
  globals: {
    a11y: {
      // ...same config available as above
    },
  },
};
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  parameters: {
    a11y: {
      /*
       * Axe's context parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#context-parameter
       * to learn more.
       */
      context: {},
      /*
       * Axe's configuration
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#api-name-axeconfigure
       * to learn more about the available properties.
       */
      config: {},
      /*
       * Axe's options parameter
       * See https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#options-parameter
       * to learn more about the available options.
       */
      options: {},
      /*
       * Configure test behavior
       * See: https://storybook.js.org/docs/next/writing-tests/accessibility-testing#test-behavior
       */
      test: 'error',
    },
  },
  globals: {
    a11y: {
      // Optional flag to prevent the automatic check
      manual: true,
    },
  },
};

export const ExampleStory = {
  parameters: {
    a11y: {
      // ...same config available as above
    },
  },
  globals: {
    a11y: {
      // ...same config available as above
    },
  },
};
```
