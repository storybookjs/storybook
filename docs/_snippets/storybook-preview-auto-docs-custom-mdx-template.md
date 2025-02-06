```jsx filename=".storybook/preview.jsx" renderer="common" language="js" tabTitle="CSF 3"
import DocumentationTemplate from './DocumentationTemplate.mdx';

export default {
  parameters: {
    docs: {
      page: DocumentationTemplate,
    },
  },
};
```

```jsx filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react, nextjs, experimental-nextjs-vite)
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

```tsx filename=".storybook/preview.tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import DocumentationTemplate from './DocumentationTemplate.mdx';

const preview: Preview = {
  parameters: {
    docs: {
      page: DocumentationTemplate,
    },
  },
};

export default preview;
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react, nextjs, experimental-nextjs-vite)
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
