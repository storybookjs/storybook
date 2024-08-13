```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  parameters: {
    actions: { argTypesRegex: '^on.*' },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on.*' },
  },
};

export default preview;
```
