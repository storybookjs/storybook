```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  parameters: {
    docs: {
      codePanel: true,
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    docs: {
      codePanel: true,
    },
  },
};

export default preview;
```
