```js filename=".storybook/preview.js" renderer="common" language="js"
import '../src/styles/global.css';

export default {
  parameters: {},
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import '../src/styles/global.css';

const preview: Preview = {
  parameters: {},
};

export default preview;
```
