```jsx filename=".storybook/preview.js|jsx" renderer="common" language="js"
export default {
  parameters: {
    docs: {
      page: null,
    },
  },
};
```

```tsx filename=".storybook/preview.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    docs: {
      page: null,
    },
  },
};

export default preview;
```
