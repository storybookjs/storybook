```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  parameters: {
    controls: { expanded: true },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
  },
};

export default preview;
```
