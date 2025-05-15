```js filename=".storybook/preview.js" renderer="common" language="js"
import MockDate from 'mockdate';

export default {
  async beforeEach() {
    MockDate.reset();
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Preview } from '@storybook/your-framework';
import MockDate from 'mockdate';

const preview: Preview = {
  async beforeEach() {
    MockDate.reset();
  },
};

export default preview;
```
