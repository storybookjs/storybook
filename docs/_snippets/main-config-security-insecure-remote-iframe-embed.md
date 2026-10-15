```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF (Legacy)"
export default {
  security: {
    insecureRemoteIframeEmbed: true,
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF (Legacy)"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  security: {
    insecureRemoteIframeEmbed: true,
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  security: {
    insecureRemoteIframeEmbed: true,
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  security: {
    insecureRemoteIframeEmbed: true,
  },
});
```
