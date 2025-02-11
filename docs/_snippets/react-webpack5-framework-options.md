<!-- TODO: Vet this example for CSF Next compatibility -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
export default {
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      // ...
    },
  },
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/react-webpack5/node';

export default defineMain({
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      // ...
    },
  },
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      // ...
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/react-webpack5/node';

export default defineMain({
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      // ...
    },
  },
});
```
