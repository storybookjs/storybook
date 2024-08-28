```js filename=".storybook/preview.js" renderer="common" language="js"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

export default {
  parameters: {
    viewport: {
      viewports: INITIAL_VIEWPORTS,
      defaultViewport: 'ipad',
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Preview } from '@storybook/your-renderer';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

const preview: Preview = {
  parameters: {
    viewport: {
      viewports: INITIAL_VIEWPORTS,
      defaultViewport: 'ipad',
    },
  },
};

export default preview;
```
