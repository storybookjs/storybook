```js filename=".storybook/preview.jsx" renderer="vue" language="js"
import { useArgs } from 'storybook/preview-api';

const WithIncrementDecorator = {
  args: {
    counter: 0,
  },
  decorators: [
    (story, { args }) => {
      const [, updateArgs] = useArgs();
      return {
        components: { story },
        setup() {
          return { args, updateArgs };
        },
        template: `
          <div>
            <button @click="() => updateArgs({ counter: args.counter + 1 })">
              Increment
            </button>
            <story />
          </div>
        `,
      };
    },
  ],
};
```

```ts filename=".storybook/preview.tsx" renderer="vue" language="ts"
import { useArgs } from 'storybook/preview-api';
import type { Meta, StoryObj } from '@storybook/vue3';

const WithIncrementDecorator: StoryObj<Meta<typeof MyComponent>> = {
  args: {
    counter: 0,
  },
  decorators: [
    (story, { args }) => {
      const [, updateArgs] = useArgs();
      return {
        components: { story },
        setup() {
          return { args, updateArgs };
        },
        template: `
          <div>
            <button @click="() => updateArgs({ counter: args.counter + 1 })">
              Increment
            </button>
            <story />
          </div>
        `,
      };
    },
  ],
};
```
