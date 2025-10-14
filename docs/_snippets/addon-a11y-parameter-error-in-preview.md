```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  // ...
  parameters: {
    // 👇 Fail all accessibility tests when violations are found
    a11y: { test: 'error' },
  },
};
export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  // ...
  parameters: {
    // 👇 Fail all accessibility tests when violations are found
    a11y: { test: 'error' },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  // ...
  parameters: {
    // 👇 Fail all accessibility tests when violations are found
    a11y: { test: 'error' },
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
    // 👇 Fail all accessibility tests when violations are found
    a11y: { test: 'error' },
  },
});
```
