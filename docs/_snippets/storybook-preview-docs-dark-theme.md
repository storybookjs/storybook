```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { themes } from 'storybook/theming';

export default {
  parameters: {
    docs: {
      theme: themes.dark,
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { themes } from 'storybook/theming';

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
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { themes } from 'storybook/theming';

export default definePreview({
  parameters: {
    docs: {
      theme: themes.dark,
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { themes } from 'storybook/theming';

export default definePreview({
  parameters: {
    docs: {
      theme: themes.dark,
    },
  },
});
```
