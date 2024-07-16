```tsx filename="setupTest.ts" renderer="react" language="ts"
import { beforeAll } from 'vitest';
import { render as testingLibraryRender } from '@testing-library/react';
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

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```

```tsx filename="setupTest.ts" renderer="svelte" language="ts"
import { beforeAll } from 'vitest';
import { render as testingLibraryRender } from '@testing-library/svelte';
import { setProjectAnnotations } from '@storybook/svelte';
// 👇 Import the exported annotations, if any, from the addons you're using; otherwise remove this
import * as addonAnnotations from 'my-addon/preview';
import * as previewAnnotations from './.storybook/preview';

const annotations = setProjectAnnotations([
  previewAnnotations,
  addonAnnotations,
  // You MUST provide this option to use portable stories with vitest
  { testingLibraryRender },
]);

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```

```tsx filename="setupTest.ts" renderer="vue" language="ts"
import { beforeAll } from 'vitest';
import { render as testingLibraryRender } from '@testing-library/vue';
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

// Run Storybook's beforeAll hook
beforeAll(annotations.beforeAll);
```
