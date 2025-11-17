```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF 3"
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

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF 3"
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

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  // ...
  parameters: {
    // ...
    nextjs: {
      appDirectory: true,
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  // ...
  parameters: {
    // ...
    nextjs: {
      appDirectory: true,
    },
  },
});
```
