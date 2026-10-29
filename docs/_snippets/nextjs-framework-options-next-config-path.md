```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 4"
import path from 'node:path';

// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  framework: {
    name: '@storybook/your-framework',
    options: {
      nextConfigPath: path.resolve(process.cwd(), 'next.config.js'),
    },
  },
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 4"
import path from 'node:path';

// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  framework: {
    name: '@storybook/your-framework',
    options: {
      nextConfigPath: path.resolve(process.cwd(), 'next.config.js'),
    },
  },
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import path from 'node:path';

// Replace your-framework with nextjs or nextjs-vite
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  framework: {
    name: '@storybook/your-framework',
    options: {
      nextConfigPath: path.resolve(process.cwd(), 'next.config.js'),
    },
  },
};

export default config;
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import path from 'node:path';

export default {
  // ...
  framework: {
    name: '@storybook/your-framework',
    options: {
      nextConfigPath: path.resolve(process.cwd(), 'next.config.js'),
    },
  },
};
```
