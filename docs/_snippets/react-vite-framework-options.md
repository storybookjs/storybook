```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
export default {
  framework: {
    name: '@storybook/react-vite',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    options: {
      // ...
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: {
    name: '@storybook/react-vite',
    options: {
      // ...
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: {
    name: '@storybook/react-vite',
    options: {
      // ...
    },
  },
});
```
