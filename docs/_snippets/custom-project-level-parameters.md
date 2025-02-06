```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
const preview = {
  // 👇 Project-level parameters
  parameters: {
    layout: 'centered',
    demo: {
      demoProperty: 'a',
      demoArray: [1, 2],
    },
  },
  // ...
};
export default preview;
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  // 👇 Project-level parameters
  parameters: {
    layout: 'centered',
    demo: {
      demoProperty: 'a',
      demoArray: [1, 2],
    },
  },
  // ...
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-renderer';

const preview: Preview = {
  // 👇 Project-level parameters
  parameters: {
    layout: 'centered',
    demo: {
      demoProperty: 'a',
      demoArray: [1, 2],
    },
  },
  // ...
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

export default definePreview({
  // 👇 Project-level parameters
  parameters: {
    layout: 'centered',
    demo: {
      demoProperty: 'a',
      demoArray: [1, 2],
    },
  },
  // ...
});
```
