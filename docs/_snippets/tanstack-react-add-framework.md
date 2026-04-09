```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
export default {
  // ...
  framework: '@storybook/tanstack-react',
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/tanstack-react';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/tanstack-react',
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/tanstack-react/node';

export default defineMain({
  // ...
  framework: '@storybook/tanstack-react',
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/tanstack-react/node';

export default defineMain({
  // ...
  framework: '@storybook/tanstack-react',
});
```