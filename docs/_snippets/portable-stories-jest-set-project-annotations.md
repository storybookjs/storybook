```tsx filename="setupTest.ts" renderer="react" language="ts"
import { beforeAll } from '@jest/globals';
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

// Supports beforeAll hook from Storybook
beforeAll(annotations.beforeAll);
```

```tsx filename="setupTest.ts" renderer="vue" language="ts"
import { beforeAll } from '@jest/globals';
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

// Supports beforeAll hook from Storybook
beforeAll(annotations.beforeAll);
```
