<!-- TODO: Vet this example for addon usage in CSF Next -->

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { MDXProvider } from '@mdx-js/react';

import { DocsContainer } from '@storybook/blocks';

import * as DesignSystem from 'your-design-system';

export const MyDocsContainer = (props) => (
  <MDXProvider
    components={{
      h1: DesignSystem.H1,
      h2: DesignSystem.H2,
    }}
  >
    <DocsContainer {...props} />
  </MDXProvider>
);

export default {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      container: MyDocsContainer,
    },
  },
};
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { DocsContainer } from '@storybook/blocks';

import { MDXProvider } from '@mdx-js/react';

import * as DesignSystem from 'your-design-system';

export default {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      container: MyDocsContainer,
    },
  },

  MyDocsContainer: (props) => (
    <MDXProvider
      components={{
        h1: DesignSystem.H1,
        h2: DesignSystem.H2,
      }}
    >
      <DocsContainer {...props} />
    </MDXProvider>
  ),
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { MDXProvider } from '@mdx-js/react';

import { DocsContainer } from '@storybook/blocks';

import * as DesignSystem from 'your-design-system';

export const MyDocsContainer = (props) => (
  <MDXProvider
    components={{
      h1: DesignSystem.H1,
      h2: DesignSystem.H2,
    }}
  >
    <DocsContainer {...props} />
  </MDXProvider>
);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      container: MyDocsContainer,
    },
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { MDXProvider } from '@mdx-js/react';

import { DocsContainer } from '@storybook/blocks';

import * as DesignSystem from 'your-design-system';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      container: MyDocsContainer,
    },
  },

  MyDocsContainer: (props) => (
    <MDXProvider
      components={{
        h1: DesignSystem.H1,
        h2: DesignSystem.H2,
      }}
    >
      <DocsContainer {...props} />
    </MDXProvider>
  ),
};

export default preview;
```
