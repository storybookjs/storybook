```js filename=".storybook/main.js" renderer="react" language="js"
export default {
  // ...
  framework: '@storybook/react-webpack5', // 👈 Add this
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts"
import { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/react-webpack5', // 👈 Add this
};

export default config;
```

