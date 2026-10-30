```diff filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 4"
- import { definePreview } from '@storybook/react-vite';
+ import { definePreview } from '@storybook/tanstack-react';

export default definePreview({
  //...
});
```

```diff filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
- import type { Preview } from '@storybook/react-vite';
+ import type { Preview } from '@storybook/tanstack-react';

const preview: Preview = {
  //...
};

export default preview;
```
