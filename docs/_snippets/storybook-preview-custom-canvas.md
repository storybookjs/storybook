<!-- TODO: Vet this example against CSF factory API -->

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { MyCanvas } from './MyCanvas';

export default {
  parameters: {
    docs: {
      components: {
        Canvas: MyCanvas,
      },
    },
  },
};
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { MyCanvas } from './MyCanvas';

export default definePreview({
  parameters: {
    docs: {
      components: {
        Canvas: MyCanvas,
      },
    },
  },
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { MyCanvas } from './MyCanvas';

const preview: Preview = {
  parameters: {
    docs: {
      components: {
        Canvas: MyCanvas,
      },
    },
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { MyCanvas } from './MyCanvas';

export default definePreview({
  parameters: {
    docs: {
      components: {
        Canvas: MyCanvas,
      },
    },
  },
});
```
