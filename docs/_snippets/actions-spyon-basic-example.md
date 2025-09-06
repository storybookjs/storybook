```ts filename=".storybook/preview.ts" renderer="common" language="ts"
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

```js filename=".storybook/preview.js" renderer="common" language="js"
import { spyOn } from 'storybook/test';

export default {
  async beforeEach() {
    spyOn(console, 'log').mockName('console.log');
  },
};
```
