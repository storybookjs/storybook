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

```ts filename=".storybook/preview.ts" renderer="common" language="ts-4-9"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Preview } from '@storybook/your-renderer';

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

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  argTypes: {
    // 👇 All stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
};

export default preview;
```

