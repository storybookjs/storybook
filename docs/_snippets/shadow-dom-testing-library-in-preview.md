```ts filename=".storybook/preview.ts" renderer="web-components" language="ts"
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

```js filename=".storybook/preview.js" renderer="web-components" language="js"
import { within as withinShadow } from 'shadow-dom-testing-library';

export default {
  // 👇 Augment the canvas with the shadow DOM queries
  beforeEach({ canvasElement, canvas }) {
    Object.assign(canvas, { ...withinShadow(canvasElement) });
  },
  // ...
};
```
