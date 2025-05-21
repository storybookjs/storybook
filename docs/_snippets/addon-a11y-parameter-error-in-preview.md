```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  // ...
  parameters: {
    // 👇 Fail all accessibility tests when violations are found
    a11y: { test: 'error' },
  },
};
export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  // ...
  parameters: {
    // 👇 Fail all accessibility tests when violations are found
    a11y: { test: 'error' },
  },
};
```
