```tsx filename="setupTest.ts" renderer="react" language="ts"
import { beforeAll } from 'vitest';
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { setProjectAnnotations } from '@storybook/your-framework';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations, addonAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```

```tsx filename="setupTest.ts" renderer="svelte" language="ts"
import { beforeAll } from 'vitest';
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import { setProjectAnnotations } from '@storybook/your-framework';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations, addonAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```

```tsx filename="setupTest.ts" renderer="vue" language="ts"
import { beforeAll } from 'vitest';
import { setProjectAnnotations } from '@storybook/vue3-vite';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations, addonAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```
