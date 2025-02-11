```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
export default {
  // ...
  // Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/your-framework', // 👈 Add this
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/your-framework', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
import { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/your-framework', // 👈 Add this
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/your-framework', // 👈 Add this
});
```
