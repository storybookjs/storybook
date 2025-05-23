```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  argTypes: {
    // 👇 All stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Preview } from '@storybook/your-framework';

const preview = {
  argTypes: {
    // 👇 All stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
} satisfies Preview;

export default preview;
```
