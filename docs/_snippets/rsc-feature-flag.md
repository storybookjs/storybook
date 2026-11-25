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
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/11/writing-stories/csf/upgrade
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
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/11/writing-stories/csf/upgrade
export default {
  // ...
  features: {
    experimentalRSC: true,
  },
};
```
