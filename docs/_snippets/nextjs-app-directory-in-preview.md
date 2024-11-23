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
import { Preview } from '@storybook/react';

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
