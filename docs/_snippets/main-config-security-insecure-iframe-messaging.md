```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 4"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  security: {
    insecureIframeMessaging: true,
  },
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 4"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  security: {
    insecureIframeMessaging: true,
  },
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  security: {
    insecureIframeMessaging: true,
  },
};

export default config;
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  security: {
    insecureIframeMessaging: true,
  },
};
```
