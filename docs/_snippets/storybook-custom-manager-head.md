```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  managerHead: (head) => `
    ${head}
    <link rel="icon" type="image/png" href="/logo192.png" sizes="192x192" />
  `,
});
```
