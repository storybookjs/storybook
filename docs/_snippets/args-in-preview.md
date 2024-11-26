```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts-4-9"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Preview } from '@storybook/your-renderer';

const preview = {
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
} satisfies Preview;

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  // The default value of the theme arg for all stories
  args: { theme: 'light' },
};

export default preview;
```
