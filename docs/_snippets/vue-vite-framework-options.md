```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF 3"
export default {
  features: {
    docgenServer: false,
  },
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-component-meta',
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  features: {
    docgenServer: false,
  },
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-component-meta',
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  features: {
    docgenServer: false,
  },
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-component-meta',
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  features: {
    docgenServer: false,
  },
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-component-meta',
    },
  },
});
```
