```jsx filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 3"
import React from 'react';

import { ThemeProvider } from 'styled-components';

// themes = { light, dark }
import * as themes from '../src/themes';

export default {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading the theme value from parameters
      const { theme = 'light' } = parameters;
      return (
        <ThemeProvider theme={themes[theme]}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
};
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
import React from 'react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

// themes = { light, dark }
import * as themes from '../src/themes';

const preview: Preview = {
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading the theme value from parameters
      const { theme = 'light' } = parameters;
      return (
        <ThemeProvider theme={themes[theme]}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
};

export default preview;
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

// themes = { light, dark }
import * as themes from '../src/themes';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading the theme value from parameters
      const { theme = 'light' } = parameters;
      return (
        <ThemeProvider theme={themes[theme]}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

// themes = { light, dark }
import * as themes from '../src/themes';

export default definePreview({
  decorators: [
    // 👇 Defining the decorator in the preview file applies it to all stories
    (Story, { parameters }) => {
      // 👇 Make it configurable by reading the theme value from parameters
      const { theme = 'light' } = parameters;
      return (
        <ThemeProvider theme={themes[theme]}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
});
```
