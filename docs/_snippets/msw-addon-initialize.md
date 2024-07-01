```js filename=".storybook/preview.js" renderer="common" language="js"
import { initialize, mswLoader } from 'msw-storybook-addon';

/*
 * Initializes MSW
 * See https://github.com/mswjs/msw-storybook-addon#configuring-msw
 * to learn how to customize it
 */
initialize();

export default {
  // ... rest of preview configuration
  loaders: [mswLoader], // 👈 Add the MSW loader to all stories
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue, etc.)
import { Preview } from '@storybook/your-renderer';

import { initialize, mswLoader } from 'msw-storybook-addon';

/*
 * Initializes MSW
 * See https://github.com/mswjs/msw-storybook-addon#configuring-msw
 * to learn how to customize it
 */
initialize();

const preview: Preview = {
  // ... rest of preview configuration
  loaders: [mswLoader], // 👈 Add the MSW loader to all stories
};

export default preview;
```

