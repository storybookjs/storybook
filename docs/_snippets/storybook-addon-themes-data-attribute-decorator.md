```js filename=".storybook/preview.js" renderer="common" language="js"
import { withThemeByDataAttribute } from '@storybook/addon-themes';

import '../src/index.css'; // Your application's global CSS file

const preview = {
  decorators: [
    withThemeByDataAttribute({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
  ],
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Preview, Renderer } from '@storybook/your-framework';

import { withThemeByDataAttribute } from '@storybook/addon-themes';

import '../src/index.css'; // Your application's global CSS file

const preview: Preview = {
  decorators: [
    withThemeByDataAttribute<Renderer>({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
  ],
};

export default preview;
```
