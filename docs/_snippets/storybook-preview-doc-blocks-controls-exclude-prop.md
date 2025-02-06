```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  parameters: {
    docs: {
      controls: { exclude: ['style'] },
    },
  },
};
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    docs: {
      controls: { exclude: ['style'] },
    },
  },
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    docs: {
      controls: { exclude: ['style'] },
    },
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    docs: {
      controls: { exclude: ['style'] },
    },
  },
});
```
