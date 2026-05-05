```diff filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
- import type { Preview } from '@storybook/react-vite';
+ import type { Preview } from '@storybook/tanstack-react';

const preview: Preview = {
  //...
};

export default preview;
```

```diff filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
- import { definePreview } from '@storybook/react-vite';
+ import { definePreview } from '@storybook/tanstack-react';

export default definePreview({
  //...
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->
