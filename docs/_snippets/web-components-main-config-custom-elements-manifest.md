```js filename=".storybook/main.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  framework: {
    name: '@storybook/web-components-vite',
    options: {
      customElementsManifest: '../custom-elements.json',
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/web-components-vite',
    options: {
      customElementsManifest: '../custom-elements.json',
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/web-components-vite',
    options: {
      customElementsManifest: '../custom-elements.json',
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/web-components-vite',
    options: {
      customElementsManifest: '../custom-elements.json',
    },
  },
});
```
