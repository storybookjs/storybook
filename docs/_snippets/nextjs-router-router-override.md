<!-- Vet this example for package naming -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF 3"
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/nextjs/router.mock';

export default {
  parameters: {
    nextjs: {
      // 👇 Override the default router properties
      router: {
        basePath: '/app/',
      },
    },
  },
  async beforeEach() {
    // 👇 Manipulate the default router method mocks
    getRouter().push.mockImplementation(() => {
      /* ... */
    });
  },
};
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/nextjs/router.mock';

export default definePreview({
  parameters: {
    nextjs: {
      // 👇 Override the default router properties
      router: {
        basePath: '/app/',
      },
    },
  },

  async beforeEach() {
    // 👇 Manipulate the default router method mocks
    getRouter().push.mockImplementation(() => {
      /* ... */
    });
  },
});
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Preview } from '@storybook/react';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/nextjs/router.mock';

const preview: Preview = {
  parameters: {
    nextjs: {
      // 👇 Override the default router properties
      router: {
        basePath: '/app/',
      },
    },
  },
  async beforeEach() {
    // 👇 Manipulate the default router method mocks
    getRouter().push.mockImplementation(() => {
      /* ... */
    });
  },
};
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/nextjs/router.mock';

export default definePreview({
  parameters: {
    nextjs: {
      // 👇 Override the default router properties
      router: {
        basePath: '/app/',
      },
    },
  },

  async beforeEach() {
    // 👇 Manipulate the default router method mocks
    getRouter().push.mockImplementation(() => {
      /* ... */
    });
  },
});
```
