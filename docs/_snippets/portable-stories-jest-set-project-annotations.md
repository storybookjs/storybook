```tsx filename="setupTest.ts" renderer="react" language="ts"
import { beforeAll } from '@jest/globals';
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { setProjectAnnotations } from '@storybook/your-framework';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations, addonAnnotations]);

// Supports beforeAll hook from Storybook
beforeAll(annotations.beforeAll);
```

```tsx filename="setupTest.ts" renderer="vue" language="ts"
import { beforeAll } from '@jest/globals';
import { setProjectAnnotations } from '@storybook/vue3-vite';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations, addonAnnotations]);

// Supports beforeAll hook from Storybook
beforeAll(annotations.beforeAll);
```
