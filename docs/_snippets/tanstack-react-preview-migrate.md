```diff filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF (Legacy)"
- import type { Preview } from '@storybook/react-vite';
+ import type { Preview } from '@storybook/tanstack-react';

const preview: Preview = {
  //...
};

export default preview;
```

```diff filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF"
- import { definePreview } from '@storybook/react-vite';
+ import { definePreview } from '@storybook/tanstack-react';

export default definePreview({
  //...
});
```
