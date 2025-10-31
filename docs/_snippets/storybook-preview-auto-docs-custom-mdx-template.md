```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import DocumentationTemplate from './DocumentationTemplate.mdx';

export default {
  parameters: {
    docs: {
      page: DocumentationTemplate,
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

import DocumentationTemplate from './DocumentationTemplate.mdx';

const preview = {
  parameters: {
    docs: {
      page: DocumentationTemplate,
    },
  },
} satisfies Preview;

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import DocumentationTemplate from './DocumentationTemplate.mdx';

export default definePreview({
  parameters: {
    docs: {
      page: DocumentationTemplate,
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import DocumentationTemplate from './DocumentationTemplate.mdx';

export default definePreview({
  parameters: {
    docs: {
      page: DocumentationTemplate,
    },
  },
});
```
