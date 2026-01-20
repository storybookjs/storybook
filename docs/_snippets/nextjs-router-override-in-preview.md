```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with nextjs or nextjs-vite
import { getRouter } from '@storybook/your-framework/router';

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

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF 3"
// Replace your-framework with nextjs or nextjs-vite
import type { Preview } from '@storybook/your-framework';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from "@storybook/your-framework/router.mock";

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

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with nextjs or nextjs-vite
import { definePreview } from '@storybook/your-framework';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/your-framework/router.mock';

const preview = definePreview({
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

export default preview;
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with nextjs or nextjs-vite
import { definePreview } from '@storybook/your-framework';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/your-framework/router.mock';

const preview = definePreview({
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

export default preview;
```
