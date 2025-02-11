```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
export default {
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/experimental-nextjs-vite', // 👈 Add this
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/experimental-nextjs-vite/node';

export default defineMain({
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/experimental-nextjs-vite', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
import { StorybookConfig } from '@storybook/experimental-nextjs-vite';

const config: StorybookConfig = {
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/experimental-nextjs-vite', // 👈 Add this
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/experimental-nextjs-vite/node';

export default defineMain({
  // ...
  // framework: '@storybook/react-webpack5', 👈 Remove this
  framework: '@storybook/experimental-nextjs-vite', // 👈 Add this
});
```
