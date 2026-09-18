# 🏁 Getting started with `@emotion/styled`

## 📦 Install addon

To get started, **install the package** as a dev dependency.

yarn:

```zsh
yarn add -D @storybook/addon-themes
```

npm:

```zsh
npm install -D @storybook/addon-themes
```

pnpm:

```zsh
pnpm add -D @storybook/addon-themes
```

## 🧩 Register Addon

Now, **include the addon** in your `.storybook/main.js` file.

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
+import { withThemeFromJSXProvider } from '@storybook/addon-themes';
+import { ThemeProvider } from '@emotion/react';
+import { GlobalStyles, lightTheme, darkTheme } from '../src/themes'; // Import your custom theme configs


const preview: Preview = {
  parameters: { /* ... */ },
+ decorators: [
+  withThemeFromJSXProvider<Renderer>({
+    themes: {
+      light: lightTheme,
+      dark: darkTheme,
+    },
+    defaultTheme: 'light',
+    Provider: ThemeProvider,
+    GlobalStyles: GlobalStyles,
+  }),
+ ]
};

export default preview;
```
