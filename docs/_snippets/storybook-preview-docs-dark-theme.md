```js filename=".storybook/preview.js" renderer="common" language="js"
import { themes } from '@storybook/theming';

export default {
  parameters: {
    docs: {
      theme: themes.dark,
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { themes } from '@storybook/theming';

const preview: Preview = {
  parameters: {
    docs: {
      theme: themes.dark,
    },
  },
};

export default preview;
```
