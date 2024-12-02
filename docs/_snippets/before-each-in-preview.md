```js filename=".storybook/preview.js" renderer="common" language="js"
import MockDate from 'mockdate';

export default {
  async beforeEach() {
    MockDate.reset();
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Preview } from '@storybook/your-renderer';
import MockDate from 'mockdate';

const preview: Preview = {
  async beforeEach() {
    MockDate.reset();
  },
};

export default preview;
```
