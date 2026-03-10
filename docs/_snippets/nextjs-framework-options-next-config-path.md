```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
import path from 'node:path';

export default {
  // ...
  framework: {
    name: '@storybook/your-framework',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(process.cwd(), 'next.config.js'),
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
import path from 'node:path';

// Replace your-framework with nextjs or nextjs-vite
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  framework: {
    name: '@storybook/your-framework',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(process.cwd(), 'next.config.js'),
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import path from 'node:path';

// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  framework: {
    name: '@storybook/your-framework',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(process.cwd(), 'next.config.js'),
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import path from 'node:path';

// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  framework: {
    name: '@storybook/your-framework',
    options: {
      image: {
        loading: 'eager',
      },
      nextConfigPath: path.resolve(process.cwd(), 'next.config.js'),
    },
  },
});
```
