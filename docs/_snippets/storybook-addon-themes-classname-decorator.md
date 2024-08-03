```js filename=".storybook/preview.js" renderer="common" language="js"
import { withThemeByClassName } from '@storybook/addon-themes';

import '../src/index.css'; // Your application's global CSS file

const preview = {
  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts-4-9"
// Replace your-renderer with the framework you are using (e.g., react, vue3)
import { Preview, Renderer } from '@storybook/your-renderer';
import { withThemeByClassName } from '@storybook/addon-themes';

import '../src/index.css'; // Your application's global CSS file

const preview: Preview = {
  decorators: [
    withThemeByClassName<Renderer>({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-renderer with the framework you are using (e.g., react, vue3)
import { Preview, Renderer } from '@storybook/your-renderer';
import { withThemeByClassName } from '@storybook/addon-themes';

import '../src/index.css'; // Your application's global CSS file

const preview: Preview = {
  decorators: [
    withThemeByClassName<Renderer>({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
};

export default preview;
```

