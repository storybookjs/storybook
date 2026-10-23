```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 4"
// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  features: {
    experimentalRSC: true,
  },
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 4"
// Replace your-framework with nextjs or nextjs-vite
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  features: {
    experimentalRSC: true,
  },
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF 3 is deprecated and will be removed in Storybook 12
// Replace your-framework with nextjs or nextjs-vite
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  features: {
    experimentalRSC: true,
  },
};

export default config;
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF 3 is deprecated and will be removed in Storybook 12
export default {
  // ...
  features: {
    experimentalRSC: true,
  },
};
```
