<!-- Vet this example for package naming -->

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

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
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

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Preview } from '@storybook/react';

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
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
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
