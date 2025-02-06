```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  parameters: {
    options: {
      storySort: {
        method: '',
        order: [],
        locales: '',
      },
    },
  },
};
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    options: {
      storySort: {
        method: '',
        order: [],
        locales: '',
      },
    },
  },
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        method: '',
        order: [],
        locales: '',
      },
    },
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    options: {
      storySort: {
        method: '',
        order: [],
        locales: '',
      },
    },
  },
});
```
