```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="globals-api"
export default {
  parameters: {
    viewport: {
      // newViewports would be an ViewportMap. (see below for examples)
      options: newViewports,
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
      // newViewports would be an ViewportMap. (see below for examples)
      options: newViewports,
    },
  },
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="without-globals"
export default {
  parameters: {
    viewport: {
      viewports: newViewports, // newViewports would be an ViewportMap. (see below for examples)
      defaultViewport: 'someDefault',
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="without-globals"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    viewport: {
      viewports: newViewports, // newViewports would be an ViewportMap. (see below for examples)
      defaultViewport: 'someDefault',
    },
  },
};

export default preview;
```
