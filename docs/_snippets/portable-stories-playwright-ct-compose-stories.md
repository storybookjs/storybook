```tsx filename="playwright/index.tsx" renderer="react" language="ts"
import { test } from '@playwright/experimental-ct-react';
import { setProjectAnnotations } from '@storybook/react';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([
  previewAnnotations,
  addonAnnotations,
  // You MUST provide this option to use portable stories with vitest
  { testingLibraryRender },
]);

// Supports beforeAll hook from Storybook
test.beforeAll(annotations.beforeAll);
```

```tsx filename="playwright/index.tsx"  renderer="vue" language="ts"
import { test } from '@playwright/experimental-ct-vue';
import { setProjectAnnotations } from '@storybook/vue3';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([
  previewAnnotations,
  addonAnnotations,
  // You MUST provide this option to use portable stories with vitest
  { testingLibraryRender },
]);

// Supports beforeAll hook from Storybook
test.beforeAll(annotations.beforeAll);
```
