```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 4"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/react-vite', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 4"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/react-vite', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/11/writing-stories/csf/upgrade
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/react-vite', // 👈 Add this
};

export default config;
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/11/writing-stories/csf/upgrade
export default {
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/react-vite', // 👈 Add this
};
```
