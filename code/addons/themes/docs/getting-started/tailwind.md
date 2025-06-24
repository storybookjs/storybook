# 🏁 Getting started with `tailwind.css`

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

## 🥾 Import your CSS

To give your stories access to Tailwind styles, import them into your `.storybook/preview.js` file.

```diff
import { Preview } from '@storybook/your-renderer';

+import '../src/index.css';

const preview: Preview = {
  parameters: { /* ... */ },
};

export default preview;
```

## 🎨 Provide your theme(s)

Tailwind supports light and dark color modes out of the box. These modes can be activated by setting a `.dark` class on a parent element.

To enable switching between these modes in a click for your stories, use our `withThemeByClassName` decorator by adding the following code to your `.storybook/preview.js` file.

```diff
-import { Preview } from '@storybook/your-renderer';
+import { Preview, Renderer } from '@storybook/your-renderer';
+import { withThemeByClassName } from '@storybook/addon-themes';

import '../src/index.css';


const preview: Preview = {
  parameters: { /* ... */ },
+ decorators: [
+  withThemeByClassName<Renderer>({
+    themes: {
+      light: '',
+      dark: 'dark',
+    },
+    defaultTheme: 'light',
+  }),
+ ]
};

export default preview;
```

## 🏷️ Using a data-attribute for theme?

If you've configured Tailwind to toggle themes with a data attribute, use our `withThemeByDataAttribute` decorator by adding the following code to your `.storybook/preview.js` file.

```diff
-import { Preview } from '@storybook/your-renderer';
+import { Preview, Renderer } from '@storybook/your-renderer';
+import { withThemeByDataAttribute } from '@storybook/addon-themes';

import '../src/index.css';


const preview: Preview = {
  parameters: { /* ... */ },
+ decorators: [
+  withThemeByDataAttribute<Renderer>({
+    themes: {
+      light: 'light',
+      dark: 'dark',
+    },
+    defaultTheme: 'light',
+    attributeName: 'data-theme',
+  }),
+ ]
};

export default preview;
```
