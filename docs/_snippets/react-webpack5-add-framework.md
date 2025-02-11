<!-- TODO: Vet this example for CSF Next compatibility -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
export default {
  // ...
  framework: '@storybook/react-webpack5', // 👈 Add this
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/react-webpack5/node';

export default defineMain({
  // ...
  framework: '@storybook/react-webpack5', // 👈 Add this
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
import { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/react-webpack5', // 👈 Add this
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/react-webpack5/node';

export default defineMain({
  // ...
  framework: '@storybook/react-webpack5', // 👈 Add this
});
```
