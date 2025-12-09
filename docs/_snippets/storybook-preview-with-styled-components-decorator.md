```ts filename=".storybook/preview.ts" renderer="angular" language="ts"
import { componentWrapperDecorator } from '@storybook/angular';
import type { Preview } from '@storybook/angular';

import { ThemeProvider } from './theme-provider.component';

const preview: Preview = {
  decorators: [
    moduleMetadata({ declarations: [ThemeProvider] }),
    componentWrapperDecorator(
      (story) => `<theme-provider class="default">${story}</theme-provider>`,
    ),
  ],
};
export default preview;

// or with globals of story context
const preview: Preview = {
  decorators: [
    moduleMetadata({ declarations: [ThemeProvider] }),
    componentWrapperDecorator(
      (story) => `<theme-provider [class]="theme">${story}</theme-provider>`,
      ({ globals }) => ({ theme: globals.theme }),
    ),
  ],
};
export default preview;
```

```jsx filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF 3"
import React from 'react';

import { ThemeProvider } from 'styled-components';

export default {
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
};
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 3"
import React from 'react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="solid" language="js"
import { ThemeProvider } from 'solid-styled-components';

const theme = {
  colors: {
    primary: 'hotpink',
  },
};

export const decorators = [
  (Story) => (
    <ThemeProvider theme={theme}>
      <Story />
    </ThemeProvider>
  ),
];
```

```tsx filename=".storybook/preview.tsx" renderer="solid" language="ts"
import type { Preview } from 'storybook-solidjs-vite';

import { ThemeProvider, DefaultTheme } from 'solid-styled-components';

const theme: DefaultTheme = {
  colors: {
    primary: 'hotpink',
  },
};

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

export default definePreview({
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { ThemeProvider } from 'styled-components';

export default definePreview({
  decorators: [
    (Story) => (
      <ThemeProvider theme="default">
        {/* 👇 Decorators in Storybook also accept a function. Replace <Story/> with Story() to enable it  */}
        <Story />
      </ThemeProvider>
    ),
  ],
});
```
