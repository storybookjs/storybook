```tsx filename="playwright/index.tsx" renderer="react" language="ts"
import { test } from '@playwright/experimental-ct-react';
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { setProjectAnnotations } from '@storybook/your-framework';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations, addonAnnotations]);

// Supports beforeAll hook from Storybook
test.beforeAll(annotations.beforeAll);
```

```tsx filename="playwright/index.tsx"  renderer="vue" language="ts"
import { test } from '@playwright/experimental-ct-vue';
import { setProjectAnnotations } from '@storybook/vue3-vite';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations, addonAnnotations]);

// Supports beforeAll hook from Storybook
test.beforeAll(annotations.beforeAll);
```
