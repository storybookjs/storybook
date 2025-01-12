# 🏁 Getting started with `postcss`

## 📦 Install addon

To get started, **install the package** as a dev dependency

yarn:

```zsh
yarn add -D @storybook/addon-themes postcss-dark-theme-class
```

npm:

```zsh
npm install -D @storybook/addon-themes postcss-dark-theme-class
```

pnpm:

```zsh
pnpm add -D @storybook/addon-themes postcss-dark-theme-class
```

## 🧩 Register Addon

Now, **include the addon** in your `.storybook/main.js` file.

```diff
module.exports = {
  stories: [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
+   "@storybook/addon-themes"
  ],
};
```

## 🏷️ Add class to `prefers-color-scheme` media

CSS has special media at-rule for dark theme: `@media (prefers-color-scheme: dark)`. [`postcss-dark-theme-class`](https://github.com/postcss/postcss-dark-theme-class) can copy content of those at-rules to `.is-dark` selector.

Check your project for existing PostCSS config: `postcss.config.js` in the project root, `"postcss"` section in `package.json` or postcss in bundle config.

Add plugin to the list.

```diff
module.exports = {
  plugins: [
+   require('postcss-dark-theme-class'),
    require('autoprefixer')
  ]
}
```

Use `prefers-color-scheme` media in your CSS:

```css
:root {
  --text-color: black;
}
@media (prefers-color-scheme: dark) {
  html {
    --text-color: white;
  }
}
```

## 🥾 Import your CSS

To give your stories access to styles, import them into your `.storybook/preview.js` file.

```diff
import { Preview } from "@storybook/your-renderer";

+import "../src/index.css";

const preview: Preview = {
  parameters: { /* ... */ },
};

export default preview;
```

## 🎨 Provide your theme(s)

To enable switching between these modes in a click for your stories, use our `withThemeByClassName` decorator by adding the following code to your `.storybook/preview.js` file.

```diff
-import { Preview } from "@storybook/your-renderer";
+import { Preview, Renderer } from "@storybook/your-renderer";
+import { withThemeByClassName } from "@storybook/addon-themes";

import "../src/index.css";


const preview: Preview = {
  parameters: { /* ... */ },
+ decorators: [
+  withThemeByClassName<Renderer>({
+    themes: {
+      light: "is-light",
+      dark: "is-dark",
+    },
+    defaultTheme: "light",
+  }),
+ ]
};

export default preview;
```
