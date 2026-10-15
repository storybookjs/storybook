```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF (Legacy)"
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF (Legacy)"
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF"
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

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF"
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
