```ts filename="setupTest.ts" renderer="common" language="ts" tabTitle="CSF 4"
import { beforeAll } from 'vitest';
// 👇 No longer necessary
import preview from './.storybook/preview';

// Run Storybook's beforeAll hook
beforeAll(preview.composed.beforeAll);
```

```tsx filename="setupTest.ts" renderer="common" language="ts" tabTitle="CSF 3"
import { beforeAll } from 'vitest';
// Replace your-framework with the framework you are using, e.g. nextjs-vite, vue3-vite etc.
import { setProjectAnnotations } from '@storybook/your-framework';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations, addonAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```
