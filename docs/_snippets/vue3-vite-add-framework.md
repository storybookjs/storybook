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
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
};

export default config;
```

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
};
```
