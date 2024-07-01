```js filename=".storybook/preview.js" renderer="common" language="js"
import { themes, ensure } from '@storybook/theming';

export default {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      theme: ensure(themes.dark), // The replacement theme to use
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { themes, ensure } from '@storybook/theming';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      theme: ensure(themes.dark), // The replacement theme to use
    },
  },
};

export default preview;
```

