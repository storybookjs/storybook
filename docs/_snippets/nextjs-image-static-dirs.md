```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF (Legacy)"
export default {
  // ...
  staticDirs: [
    {
      from: '../src/components/fonts',
      to: 'src/components/fonts',
    },
  ],
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF (Legacy)"
// Replace your-framework with nextjs or nextjs-vite
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  staticDirs: [
    {
      from: '../src/components/fonts',
      to: 'src/components/fonts',
    },
  ],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF"
// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  staticDirs: [
    {
      from: '../src/components/fonts',
      to: 'src/components/fonts',
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF"
// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  staticDirs: [
    {
      from: '../src/components/fonts',
      to: 'src/components/fonts',
    },
  ],
});
```
