```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  parameters: {
    a11y: {
      /*
       * Configure the warning levels for a11y checks
       * The available options are 'minor', 'moderate', 'serious', and 'critical'
       */
      warnings: ['minor', 'moderate'],
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    a11y: {
      /*
       * Configure the warning levels for a11y checks
       * The available options are 'minor', 'moderate', 'serious', and 'critical'
       */
      warnings: ['minor', 'moderate'],
    },
  },
};

export default preview;
```
