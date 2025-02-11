```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
import * as path from 'path';

export default {
  // Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
  framework: {
    name: '@storybook/your-framework',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(__dirname, '../next.config.js'),
    },
  },
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

import * as path from 'path';

export default defineMain({
  // Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
  framework: {
    name: '@storybook/your-framework',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(__dirname, '../next.config.js'),
    },
  },
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
import * as path from 'path';

// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
import { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/your-framework',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(__dirname, '../next.config.js'),
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

import * as path from 'path';

export default defineMain({
  framework: {
    name: '@storybook/your-framework',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(__dirname, '../next.config.js'),
    },
  },
});
```
