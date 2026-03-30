```ts filename=".storybook/preview.tsx" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Preview } from '@storybook/web-components-vite';

import { within as withinShadow } from 'shadow-dom-testing-library';

const preview: Preview = {
  // 👇 Augment the canvas with the shadow DOM queries
  beforeEach({ canvasElement, canvas }) {
    Object.assign(canvas, { ...withinShadow(canvasElement) });
  },
  // ...
};

// 👇 Extend TypeScript types for safety
export type ShadowQueries = ReturnType<typeof withinShadow>;

// Since Storybook@8.6
declare module 'storybook/internal/csf' {
  interface Canvas extends ShadowQueries {}
}

export default preview;
```

```js filename=".storybook/preview.jsx" renderer="web-components" language="js" tabTitle="CSF 3"
import { within as withinShadow } from 'shadow-dom-testing-library';

export default {
  // 👇 Augment the canvas with the shadow DOM queries
  beforeEach({ canvasElement, canvas }) {
    Object.assign(canvas, { ...withinShadow(canvasElement) });
  },
  // ...
};
```

```ts filename=".storybook/preview.tsx" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { within as withinShadow } from 'shadow-dom-testing-library';

// 👇 Extend TypeScript types for safety
export type ShadowQueries = ReturnType<typeof withinShadow>;

// Since Storybook@8.6
declare module 'storybook/internal/csf' {
  interface Canvas extends ShadowQueries {}
}

export default definePreview({
  // 👇 Augment the canvas with the shadow DOM queries
  beforeEach({ canvasElement, canvas }) {
    Object.assign(canvas, { ...withinShadow(canvasElement) });
  },
  // ...
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { within as withinShadow } from 'shadow-dom-testing-library';

export default definePreview({
  // 👇 Augment the canvas with the shadow DOM queries
  beforeEach({ canvasElement, canvas }) {
    Object.assign(canvas, { ...withinShadow(canvasElement) });
  },
  // ...
});
```
