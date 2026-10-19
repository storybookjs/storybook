```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import type { Preview } from '@storybook/your-framework';

const preview = {
  parameters: {
    jsx: {
      // 👇 Preserve the order in which props are defined, instead of sorting them alphabetically
      sortProps: false,
    },
  },
} satisfies Preview;

export default preview;
```

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 3"
export default {
  parameters: {
    jsx: {
      // 👇 Preserve the order in which props are defined, instead of sorting them alphabetically
      sortProps: false,
    },
  },
};
```

```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    jsx: {
      // 👇 Preserve the order in which props are defined, instead of sorting them alphabetically
      sortProps: false,
    },
  },
});
```

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    jsx: {
      // 👇 Preserve the order in which props are defined, instead of sorting them alphabetically
      sortProps: false,
    },
  },
});
```
