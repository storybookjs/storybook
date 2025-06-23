```tsx filename=".storybook/vitest.setup.ts" renderer="react" language="ts"
import { beforeAll } from 'vitest';
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { setProjectAnnotations } from '@storybook/your-framework';
import * as previewAnnotations from './preview';

const annotations = setProjectAnnotations([previewAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```

```tsx filename=".storybook/vitest.setup.ts" renderer="svelte" language="ts"
import { beforeAll } from 'vitest';
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import { setProjectAnnotations } from '@storybook/your-framework';
import * as previewAnnotations from './preview';

const annotations = setProjectAnnotations([previewAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```

```tsx filename=".storybook/vitest.setup.ts" renderer="vue" language="ts"
import { beforeAll } from 'vitest';
import { setProjectAnnotations } from '@storybook/vue3-vite';
import * as previewAnnotations from './preview';

const annotations = setProjectAnnotations([previewAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```
