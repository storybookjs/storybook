```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
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

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
import { StorybookConfig } from '@storybook/your-framework';

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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
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
