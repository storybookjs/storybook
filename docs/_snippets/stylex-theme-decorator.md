```tsx filename=".storybook/preview.tsx" renderer="react" language="ts"
import React from 'react';

import type { Preview } from '@storybook/your-framework';

import * as stylex from '@stylexjs/stylex';

import { darkTheme, lightTheme } from '../src/themes';

const themes = { light: lightTheme, dark: darkTheme };

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'StyleX theme',
      toolbar: { title: 'Theme', icon: 'paintbrush', items: ['light', 'dark'] },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, { globals }) => (
      <div {...stylex.props(themes[globals.theme as keyof typeof themes])}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
```
