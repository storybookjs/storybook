```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with nextjs or nextjs-vite
import { getRouter } from '@storybook/your-framework/navigation';

export default {
  parameters: {
    nextjs: {
      // 👇 Override the default navigation properties
      navigation: {
        pathname: '/app/',
      },
    },
  },
  async beforeEach() {
    // 👇 Manipulate the default navigation method mocks
    getRouter().push.mockImplementation(() => {
      /* ... */
    });
  },
};
```

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 3"
// Replace your-framework with nextjs or nextjs-vite
import type { Preview } from '@storybook/your-framework';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from "@storybook/your-framework/navigation.mock";

const preview: Preview = {
  parameters: {
    nextjs: {
      // 👇 Override the default navigation properties
      navigation: {
        pathname: '/app/',
      },
    },
  },
  async beforeEach() {
    // 👇 Manipulate the default navigation method mocks
    getRouter().push.mockImplementation(() => {
      /* ... */
    });
  },
};

export default preview;
```

```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with nextjs or nextjs-vite
import { definePreview } from '@storybook/your-framework';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/your-framework/navigation.mock';

const preview = definePreview({
  parameters: {
    nextjs: {
      // 👇 Override the default navigation properties
      navigation: {
        pathname: '/app/',
      },
    },
  },
  async beforeEach() {
    // 👇 Manipulate the default navigation method mocks
    getRouter().push.mockImplementation(() => {
      /* ... */
    });
  },
});

export default preview;
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with nextjs or nextjs-vite
import { definePreview } from '@storybook/your-framework';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/your-framework/navigation.mock';

const preview = definePreview({
  parameters: {
    nextjs: {
      // 👇 Override the default navigation properties
      navigation: {
        pathname: '/app/',
      },
    },
  },
  async beforeEach() {
    // 👇 Manipulate the default navigation method mocks
    getRouter().push.mockImplementation(() => {
      /* ... */
    });
  },
});

export default preview;
```
