# 🏁 Getting started with `bootstrap`

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
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
+   '@storybook/addon-themes',
  ],
};
```

## 🥾 Import Bootstrap

To give your stories access to Bootstrap's styles and JavaScript, import them into your `.storybook/preview.js` file.

```diff
import { Preview } from '@storybook/your-renderer';

+import 'bootstrap/dist/css/bootstrap.min.css';
+import 'bootstrap/dist/js/bootstrap.bundle';

const preview: Preview = {
  parameters: { /* ... */ },
};

export default preview;
```

## 🎨 Provide your theme(s)

Bootstrap now supports light and dark color modes out of the box as well as the ability to make your own custom modes. These modes can be activated by setting a `data-bs-theme` attribute on a parent element.

To enable switching between these modes in a click for your stories, use our `withThemeByDataAttribute` decorator by adding the following code to your `.storybook/preview.js` file.

```diff
-import { Preview } from '@storybook/your-renderer';
+import { Preview, Renderer } from '@storybook/your-renderer';
+import { withThemeByDataAttribute } from '@storybook/addon-themes';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle';

const preview: Preview = {
  parameters: { /* ... */ },
+ decorators: [
+  withThemeByDataAttribute<Renderer>({
+    themes: {
+      light: 'light',
+      dark: 'dark',
+    },
+    defaultTheme: 'light',
+    attributeName: 'data-bs-theme',
+  }),
+ ]
};

export default preview;
```
