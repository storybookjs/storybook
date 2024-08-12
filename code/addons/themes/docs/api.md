# API

## Decorators

### `withThemeFromJSXProvider`

Takes your provider component, global styles, and theme(s)to wrap your stories in.

```js
import { withThemeFromJSXProvider } from '@storybook/addon-themes';

export const decorators = [
  withThemeFromJSXProvider({
    themes: {
      light: lightTheme,
      dark: darkTheme,
    },
    defaultTheme: 'light',
    Provider: ThemeProvider,
    GlobalStyles: CssBaseline,
  }),
];
```

Available options:

| option       | type                  | required? | Description                                                                                                                                                                                         |
| ------------ | --------------------- | :-------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| themes       | `Record<string, any>` |           | An object of theme configurations where the key is the name of the theme and the value is the theme object. If multiple themes are provided, a toolbar item will be added to switch between themes. |
| defaultTheme | `string`              |           | The name of the default theme to use                                                                                                                                                                |
| Provider     |                       |           | The JSX component to provide themes                                                                                                                                                                 |
| GlobalStyles |                       |           | A JSX component containing global css styles.                                                                                                                                                       |

### `withThemeByClassName`

Takes your theme class names to apply your parent element to enable your theme(s).

```js
import { withThemeByClassName } from '@storybook/addon-themes';

export const decorators = [
  withThemeByClassName({
    themes: {
      light: 'light-theme',
      dark: 'dark-theme',
    },
    defaultTheme: 'light',
  }),
];
```

Available options:

| option         | type                     | required? | Description                                                                                                     |
| -------------- | ------------------------ | :-------: | --------------------------------------------------------------------------------------------------------------- |
| themes         | `Record<string, string>` |    ✅     | An object of theme configurations where the key is the name of the theme and the value is the theme class name. |
| defaultTheme   | `string`                 |    ✅     | The name of the default theme to use                                                                            |
| parentSelector | `string`                 |           | The selector for the parent element that you want to apply your theme class to. Defaults to "html"              |

### `withThemeByDataAttribute`

Takes your theme names and data attribute to apply your parent element to enable your theme(s).

```js
import { withThemeByDataAttribute } from '@storybook/addon-themes';

export const decorators = [
  withThemeByDataAttribute({
    themes: {
      light: 'light',
      dark: 'dark',
    },
    defaultTheme: 'light',
    attributeName: 'data-bs-theme',
  }),
];
```

available options:

| option         | type                     | required? | Description                                                                                                         |
| -------------- | ------------------------ | :-------: | ------------------------------------------------------------------------------------------------------------------- |
| themes         | `Record<string, string>` |    ✅     | An object of theme configurations where the key is the name of the theme and the value is the data attribute value. |
| defaultTheme   | `string`                 |    ✅     | The name of the default theme to use                                                                                |
| parentSelector | `string`                 |           | The selector for the parent element that you want to apply your theme class to. Defaults to "html"                  |
| attributeName  | `string`                 |           | The name of the data attribute to set on the parent element for your theme(s). Defaults to "data-theme"             |

## Writing a custom decorator

If none of these decorators work for your library there is still hope. We've provided a collection of helper functions to get access to the theme toggling state so that you can create a decorator of your own.

### `pluckThemeFromContext`

Pulls the selected theme from storybook's global state.

```js
import { DecoratorHelpers } from '@storybook/addon-themes';

const { pluckThemeFromContext } = DecoratorHelpers;

export const myCustomDecorator =
  ({ themes, defaultState, ...rest }) =>
  (storyFn, context) => {
    const selectedTheme = pluckThemeFromContext(context);

    // Snipped
  };
```

### `useThemeParameters`

Returns the theme parameters for this addon.

```js
import { DecoratorHelpers } from '@storybook/addon-themes';

const { useThemeParameters } = DecoratorHelpers;

export const myCustomDecorator =
  ({ themes, defaultState, ...rest }) =>
  (storyFn, context) => {
    const { themeOverride } = useThemeParameters();

    // Snipped
  };
```

### `initializeThemeState`

Used to register the themes and defaultTheme with the addon state.

```js
import { DecoratorHelpers } from '@storybook/addon-themes';

const { initializeThemeState } = DecoratorHelpers;

export const myCustomDecorator = ({ themes, defaultState, ...rest }) => {
  initializeThemeState(Object.keys(themes), defaultTheme);

  return (storyFn, context) => {
    // Snipped
  };
};
```

### Putting it all together

Let's use Vuetify as an example. Vuetify uses it's own global state to know which theme to render. To build a custom decorator to accommodate this method we'll need to do the following

```js
// .storybook/withVeutifyTheme.decorator.js
import { DecoratorHelpers } from '@storybook/addon-themes';
import { useTheme } from 'vuetify';

const { initializeThemeState, pluckThemeFromContext, useThemeParameters } = DecoratorHelpers;

export const withVuetifyTheme = ({ themes, defaultTheme }) => {
  initializeThemeState(Object.keys(themes), defaultTheme);

  return (story, context) => {
    const selectedTheme = pluckThemeFromContext(context);
    const { themeOverride } = useThemeParameters();

    const selected = themeOverride || selectedTheme || defaultTheme;

    return {
      components: { story },
      setup() {
        const theme = useTheme();

        theme.global.name.value = themes[selected];

        return {
          theme,
        };
      },
      template: `<v-app><story /></v-app>`,
    };
  };
};
```

This can then be provided to Storybook in `.storybook/preview.js`:

```js
// .storybook/preview.js
import { setup } from '@storybook/vue3';
import { registerPlugins } from '../src/plugins';
import { withVuetifyTheme } from './withVuetifyTheme.decorator';

setup((app) => {
  registerPlugins(app);
});

/* snipped for brevity */

export const decorators = [
  withVuetifyTheme({
    // These keys are the labels that will be displayed in the toolbar theme switcher
    // The values must match the theme keys from your VuetifyOptions
    themes: {
      light: 'light',
      dark: 'dark',
      'high contrast': 'highContrast',
    },
    defaultTheme: 'light', // The key of your default theme
  }),
];
```
