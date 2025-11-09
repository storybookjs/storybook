```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
export default {
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/nextjs', // 👈 Add this
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/nextjs', // 👈 Add this
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/nextjs', // 👈 Add this
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/nextjs', // 👈 Add this
});
```
