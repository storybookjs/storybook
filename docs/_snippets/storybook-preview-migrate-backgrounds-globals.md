```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="without-globals"
export default {
  parameters: {
    backgrounds: {
      values: [
        { name: 'twitter', value: '#00aced' },
        { name: 'facebook', value: '#3b5998' },
      ],
    },
  },
};
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="globals-api"
export default {
  parameters: {
    backgrounds: {
      options: {
        { name: 'twitter', value: '#00aced' },
        { name: 'facebook', value: '#3b5998' },
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="without-globals"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  parameters: {
    backgrounds: {
      values: [
        { name: 'twitter', value: '#00aced' },
        { name: 'facebook', value: '#3b5998' },
      ],
    },
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="globals-api"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        { name: 'twitter', value: '#00aced' },
        { name: 'facebook', value: '#3b5998' },
      },
    },
  },
};

export default preview;
```
