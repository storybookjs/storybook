```tsx filename="setupTest.ts" renderer="react" language="ts"
import { beforeAll } from 'vitest';
// 👇 If you're using Next.js, import from @storybook/nextjs
//   If you're using Next.js with Vite, import from @storybook/experimental-nextjs-vite
import { setProjectAnnotations } from '@storybook/react';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```

```tsx filename="setupTest.ts" renderer="svelte" language="ts"
import { beforeAll } from 'vitest';
// 👇 If you're using Sveltekit, import from @storybook/sveltekit
import { setProjectAnnotations } from '@storybook/svelte';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```

```tsx filename="setupTest.ts" renderer="vue" language="ts"
import { beforeAll } from 'vitest';
import { setProjectAnnotations } from '@storybook/vue3';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([previewAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```
