```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  parameters: {
    docs: {
      controls: { exclude: ['style'] },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    docs: {
      controls: { exclude: ['style'] },
    },
  },
};

export default preview;
```
