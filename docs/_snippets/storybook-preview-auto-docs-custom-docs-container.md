```jsx filename=".storybook/preview.jsx" renderer="common" language="js" tabTitle="CSF 3"
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

```tsx filename=".storybook/preview.tsx" renderer="common" language="ts" tabTitle="CSF 3"
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

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import * as React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';
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

```jsx filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import * as React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';
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

```tsx filename=".storybook/preview.tsx" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import * as React from 'react';

import { definePreview } from '@storybook/vue3-vite';
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

```jsx filename=".storybook/preview.jsx" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import * as React from 'react';

import { definePreview } from '@storybook/vue3-vite';
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

```tsx filename=".storybook/preview.tsx" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import * as React from 'react';

import { definePreview } from '@storybook/angular';
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

```jsx filename=".storybook/preview.jsx" renderer="angular" language="js" tabTitle="CSF Next 🧪"
import * as React from 'react';

import { definePreview } from '@storybook/angular';
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

```tsx filename=".storybook/preview.tsx" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import * as React from 'react';

import { definePreview } from '@storybook/web-components-vite';
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

```jsx filename=".storybook/preview.jsx" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import * as React from 'react';

import { definePreview } from '@storybook/web-components-vite';
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