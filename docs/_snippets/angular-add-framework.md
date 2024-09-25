```js filename=".storybook/main.js" renderer="angular" language="js"
export default {
  // ...
  framework: '@storybook/angular', // 👈 Add this
};
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts"
import { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/angular', // 👈 Add this
};

export default config;
```

