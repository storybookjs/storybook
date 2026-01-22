```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
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

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import { Preview, Renderer } from '@storybook/your-framework';

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

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { Renderer, definePreview } from '@storybook/your-framework';

import addonThemes from '@storybook/addon-themes';

import '../src/index.css'; // Your application's global CSS file

export default definePreview({
  addons: [addonThemes()],
  decorators: [
    addonThemes.withThemeByClassName<Renderer>({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import addonThemes from '@storybook/addon-themes';

import '../src/index.css'; // Your application's global CSS file

export default definePreview({
  addons: [addonThemes()],
  decorators: [
    addonThemes.withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
});
```
