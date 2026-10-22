<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
};

export default config;
```

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF 3"
export default {
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
};
```
