```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF 4"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF 3"
// ⚠️ CSF 3 is deprecated and will be removed in Storybook 12
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
};

export default config;
```

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF 3 is deprecated and will be removed in Storybook 12
export default {
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
};
```
