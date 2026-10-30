```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 4"
// Replace your-framework with nextjs or nextjs-vite
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

```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 4"
// Replace your-framework with nextjs or nextjs-vite
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

```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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
