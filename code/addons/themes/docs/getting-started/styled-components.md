# 🏁 Getting started with `styled-components`

## 📦 Install addon

To get started, **install the package** as a dev dependency.

yarn:

```zsh
yarn add -D @storybook/addon-themes @storybook/addon-themes-react
```

npm:

```zsh
npm install -D @storybook/addon-themes @storybook/addon-themes-react
```

pnpm:

```zsh
pnpm add -D @storybook/addon-themes @storybook/addon-themes-react
```

## 🧩 Register Addon

**Include `@storybook/addon-themes`** in your `.storybook/main.js` file. Do not register `@storybook/addon-themes-react` there. Preview code imports `withThemeFromJSXProvider` from that package.

```diff
export default {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
+   '@storybook/addon-themes',
  ],
};
```

## 🎨 Provide your theme(s)

Finally, provide your theme(s) and global styles component to your stories with our `withThemeFromJSXProvider` decorator.

Make the following changes to your `.storybook/preview.js`:

```diff
-import { Preview } from '@storybook/your-renderer';
+import { Preview, Renderer } from '@storybook/your-renderer';
+import { withThemeFromJSXProvider } from '@storybook/addon-themes-react';
+import { ThemeProvider } from 'styled-components';
+import { GlobalStyles, lightTheme, darkTheme } from '../src/themes'; // Import your custom theme configs

const preview: Preview = {
  parameters: { /* ... */ },
+ decorators: [
+   withThemeFromJSXProvider<Renderer>({
+     themes: {
+       light: lightTheme,
+       dark: darkTheme,
+     },
+     defaultTheme: 'light',
+     Provider: ThemeProvider,
+     GlobalStyles: GlobalStyles,
+   }),
+ ],
};

export default preview;
```
