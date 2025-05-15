```js filename=".storybook/preview.js" renderer="common" language="js"
import { init } from '../project-bootstrap';

export default {
  async beforeAll() {
    await init();
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Preview } from '@storybook/your-framework';

import { init } from '../project-bootstrap';

const preview: Preview = {
  async beforeAll() {
    await init();
  },
};

export default preview;
```
