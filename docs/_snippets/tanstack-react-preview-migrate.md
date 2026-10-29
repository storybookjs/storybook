```diff filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 4"
- import { definePreview } from '@storybook/react-vite';
+ import { definePreview } from '@storybook/tanstack-react';

export default definePreview({
  //...
});
```

```diff filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
- import type { Preview } from '@storybook/react-vite';
+ import type { Preview } from '@storybook/tanstack-react';

const preview: Preview = {
  //...
};

export default preview;
```
