<!-- TODO: Vet this example for addon usage in CSF Next -->

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
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

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the name of your framework (e.g., react, nextjs, experimental-nextjs)
import { definePreview } from '@storybook/your-framework';

import { initialize, mswLoader } from 'msw-storybook-addon';

/*
 * Initializes MSW
 * See https://github.com/mswjs/msw-storybook-addon#configuring-msw
 * to learn how to customize it
 */
initialize();

export default definePreview({
  // ... rest of preview configuration
  loaders: [mswLoader], // 👈 Add the MSW loader to all stories
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
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

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the name of your framework (e.g., react, nextjs, experimental-nextjs)
import { definePreview } from '@storybook/your-framework';

import { initialize, mswLoader } from 'msw-storybook-addon';

/*
 * Initializes MSW
 * See https://github.com/mswjs/msw-storybook-addon#configuring-msw
 * to learn how to customize it
 */
initialize();

export default definePreview({
  // ... rest of preview configuration
  loaders: [mswLoader], // 👈 Add the MSW loader to all stories
});
```
