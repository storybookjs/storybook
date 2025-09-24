```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, svelte)
import type { Preview } from '@storybook/your-framework';

import { spyOn } from 'storybook/test';

const preview: Preview = {
  async beforeEach() {
    spyOn(console, 'log').mockName('console.log');
  },
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { spyOn } from 'storybook/test';

export default {
  async beforeEach() {
    spyOn(console, 'log').mockName('console.log');
  },
};
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { spyOn } from 'storybook/test';

export default definePreview({
  async beforeEach() {
    spyOn(console, 'log').mockName('console.log');
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { spyOn } from 'storybook/test';

export default definePreview({
  async beforeEach() {
    spyOn(console, 'log').mockName('console.log');
  },
});
```
