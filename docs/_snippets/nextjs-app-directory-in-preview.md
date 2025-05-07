```js filename=".storybook/preview.js" renderer="react" language="js"
export default {
  // ...
  parameters: {
    // ...
    nextjs: {
      appDirectory: true,
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts"
// Replace your-framework with nextjs or nextjs-vite
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  // ...
  parameters: {
    // ...
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
```
