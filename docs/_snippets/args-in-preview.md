```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
};

export default preview;
```
