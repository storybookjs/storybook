```js filename=".storybook/preview.js" renderer="common" language="js"
import * as React from 'react';

import { DocsContainer } from '@storybook/blocks';

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

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
import * as React from 'react';

// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { DocsContainer } from '@storybook/blocks';

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

