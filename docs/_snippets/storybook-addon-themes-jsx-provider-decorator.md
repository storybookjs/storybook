```js filename=".storybook/preview.js" renderer="common" language="js"
import { withThemeFromJSXProvider } from '@storybook/addon-themes';

import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { lightTheme, darkTheme } from '../src/themes';

const GlobalStyles = createGlobalStyle`
  body {
    font-family: "Nunito Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  }
`;

const preview = {
  decorators: [
    withThemeFromJSXProvider({
      themes: {
        light: lightTheme,
        dark: darkTheme,
      },
      defaultTheme: 'light',
      Provider: ThemeProvider,
      GlobalStyles,
    }),
  ],
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Preview, Renderer } from '@storybook/your-framework';

import { withThemeFromJSXProvider } from '@storybook/addon-themes';

import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { lightTheme, darkTheme } from '../src/themes';

const GlobalStyles = createGlobalStyle`
  body {
    font-family: "Nunito Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  }
`;

const preview: Preview = {
  decorators: [
    withThemeFromJSXProvider<Renderer>({
      themes: {
        light: lightTheme,
        dark: darkTheme,
      },
      defaultTheme: 'light',
      Provider: ThemeProvider,
      GlobalStyles,
    }),
  ],
};

export default preview;
```
