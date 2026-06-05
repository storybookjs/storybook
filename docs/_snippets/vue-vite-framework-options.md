```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF 3"
export default {
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-docgen-api',
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-docgen-api',
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-docgen-api',
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-docgen-api',
    },
  },
});
```
