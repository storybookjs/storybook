```js filename=".storybook/preview.js" renderer="common" language="js"
import { init } from '../project-bootstrap';

export default {
  async beforeAll() {
    await init();
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Preview } from '@storybook/your-renderer';

import { init } from '../project-bootstrap';

const preview: Preview = {
  async beforeAll() {
    await init();
  },
};

export default preview;
```
