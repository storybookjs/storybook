```js filename=".storybook/preview.js" renderer="common" language="js"
import { CodeBlock } from './CodeBlock';

export default {
  parameters: {
    docs: {
      components: {
        code: CodeBlock,
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { CodeBlock } from './CodeBlock';

const preview: Preview = {
  parameters: {
    docs: {
      components: {
        code: CodeBlock,
      },
    },
  },
};

export default preview;
```

