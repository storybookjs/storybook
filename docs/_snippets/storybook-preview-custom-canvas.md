```js filename=".storybook/preview.js" renderer="common" language="js"
import { MyCanvas } from './MyCanvas';

export default {
  parameters: {
    docs: {
      components: {
        Canvas: MyCanvas,
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { MyCanvas } from './MyCanvas';

const preview: Preview = {
  parameters: {
    docs: {
      components: {
        Canvas: MyCanvas,
      },
    },
  },
};

export default preview;
```
