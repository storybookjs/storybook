```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., nextjs, react-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/your-framework',
    options: {
      legacyRootApi: true,
    },
  },
};

export default config;
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
export default {
  framework: {
    // Replace your-framework with the framework you are using (e.g., nextjs, react-webpack5)
    name: '@storybook/your-framework',
    options: {
      legacyRootApi: true,
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, react-webpack5)
import { defineMain } from '@storybook/your-framework/node';

const config = defineMain({
  framework: {
    name: '@storybook/your-framework',
    options: {
      legacyRootApi: true,
    },
  },
});

export default config;
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, react-webpack5)
import { defineMain } from '@storybook/your-framework/node';

const config = defineMain({
  framework: {
    name: '@storybook/your-framework',
    options: {
      legacyRootApi: true,
    },
  },
});

export default config;
```
