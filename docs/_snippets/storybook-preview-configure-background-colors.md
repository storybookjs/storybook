```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="globals-api"
export default {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#333' },
        light: { name: 'Light', value: '#F7F9F2' },
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="globals-api"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#333' },
        light: { name: 'Light', value: '#F7F9F2' },
      },
    },
  },
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="without-globals"
export default {
  parameters: {
    backgrounds: {
      default: 'Light',
      values: [
        {
          name: 'Dark',
          value: '#333',
        },
        {
          name: 'Light',
          value: '#F7F9F2',
        },
      ],
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="without-globals"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'Light',
      values: [
        {
          name: 'Dark',
          value: '#333',
        },
        {
          name: 'Light',
          value: '#F7F9F2',
        },
      ],
    },
  },
};

export default preview;
```
