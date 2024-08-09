```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="globals-api"
export default {
  parameters: {
    viewport: {
      options: customViewports,
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="globals-api"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    viewport: {
      options: customViewports,
    },
  },
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="without-globals"
export default {
  parameters: {
    viewport: { viewports: customViewports },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="without-globals"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    viewport: { viewports: customViewports },
  },
};

export default preview;
```
