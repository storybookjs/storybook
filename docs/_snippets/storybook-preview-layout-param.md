<!-- TODO: Vet this example for addon usage in CSF Next -->

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  parameters: {
    layout: 'centered',
  },
};
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    layout: 'centered',
  },
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    layout: 'centered',
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  parameters: {
    layout: 'centered',
  },
});
```
