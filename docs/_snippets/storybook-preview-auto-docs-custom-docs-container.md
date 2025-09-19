```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import * as React from 'react';

import { DocsContainer } from '@storybook/addon-docs/blocks';

const ExampleContainer = ({ children, ...props }) => {
  return <DocsContainer {...props}>{children}</DocsContainer>;
};

export default {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      container: ExampleContainer,
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
import * as React from 'react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { DocsContainer } from '@storybook/addon-docs/blocks';

const ExampleContainer = ({ children, ...props }) => {
  return <DocsContainer {...props}>{children}</DocsContainer>;
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      container: ExampleContainer,
    },
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';
import * as React from 'react';

import { DocsContainer } from '@storybook/addon-docs/blocks';

const ExampleContainer = ({ children, ...props }) => {
  return <DocsContainer {...props}>{children}</DocsContainer>;
};

export default definePreview({
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      container: ExampleContainer,
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';
import * as React from 'react';

import { DocsContainer } from '@storybook/addon-docs/blocks';

const ExampleContainer = ({ children, ...props }) => {
  return <DocsContainer {...props}>{children}</DocsContainer>;
};

export default definePreview({
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    docs: {
      container: ExampleContainer,
    },
  },
});
```
