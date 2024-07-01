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

```jsx filename=".storybook/preview.js" renderer="react" language="js"
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

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts"
import React from 'react';

import { Preview } from '@storybook/react';

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
import { Preview } from 'storybook-solidjs';
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

