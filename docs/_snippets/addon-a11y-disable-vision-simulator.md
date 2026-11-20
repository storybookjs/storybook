```js filename=".storybook/preview.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
export default {
  parameters: {
    visionSimulator: {
      disable: true,
    },
  },
};
```

```ts filename=".storybook/preview.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    visionSimulator: {
      disable: true,
    },
  },
};

export default preview;
```
