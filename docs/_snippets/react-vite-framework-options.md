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

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/react-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/react-vite',
    options: {
      // ...
    },
  },
});
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
import { defineMain } from '@storybook/react-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/react-vite',
    options: {
      // ...
    },
  },
});
```
