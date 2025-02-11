<!-- TODO: Vet this example against CSF Next API -->

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { themes } from '@storybook/theming';

export default {
  parameters: {
    docs: {
      theme: themes.dark,
    },
  },
};
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { themes } from '@storybook/theming';

export default definePreview({
  parameters: {
    docs: {
      theme: themes.dark,
    },
  },
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { themes } from '@storybook/theming';

const preview: Preview = {
  parameters: {
    docs: {
      theme: themes.dark,
    },
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { themes } from '@storybook/theming';

export default definePreview({
  parameters: {
    docs: {
      theme: themes.dark,
    },
  },
});
```
