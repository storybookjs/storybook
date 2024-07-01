```ts filename=".storybook/preview.ts" renderer="common" language="js"
export default {
  parameters: {
    backgrounds: {
      values: [
        { name: 'light', value: '#fff' },
        { name: 'dark', value: '#333' },
      ],
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  parameters: {
    backgrounds: {
      values: [
        { name: 'light', value: '#fff' },
        { name: 'dark', value: '#333' },
      ],
    },
  },
};

export default preview;
```

