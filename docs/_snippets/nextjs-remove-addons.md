```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  addons: [
    // ...
    // 👇 These can both be removed
    // 'storybook-addon-next',
    // 'storybook-addon-next-router',
  ],
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  addons: [
    // ...
    // 👇 These can both be removed
    // 'storybook-addon-next',
    // 'storybook-addon-next-router',
  ],
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with nextjs or nextjs-vite
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  addons: [
    // ...
    // 👇 These can both be removed
    // 'storybook-addon-next',
    // 'storybook-addon-next-router',
  ],
};

export default config;
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
export default {
  // ...
  addons: [
    // ...
    // 👇 These can both be removed
    // 'storybook-addon-next',
    // 'storybook-addon-next-router',
  ],
};
```
