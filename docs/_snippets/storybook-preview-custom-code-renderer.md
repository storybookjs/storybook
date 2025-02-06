<!-- TODO: Vet this example against CSF Factory API -->

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
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

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { CodeBlock } from './CodeBlock';

export default definePreview({
  parameters: {
    docs: {
      components: {
        code: CodeBlock,
      },
    },
  },
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
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

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { CodeBlock } from './CodeBlock';

export default definePreview({
  parameters: {
    docs: {
      components: {
        code: CodeBlock,
      },
    },
  },
});
```
