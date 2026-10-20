# @storybook/addon-themes-react

React provider decorator for [`@storybook/addon-themes`](https://github.com/storybookjs/storybook/tree/next/code/addons/themes).

Register `@storybook/addon-themes` in `.storybook/main`. This package is not an addon and is not added to `addons`.

```ts
import { withThemeFromJSXProvider } from '@storybook/addon-themes-react';
```

`withThemeByClassName`, `withThemeByDataAttribute`, and `DecoratorHelpers` stay in `@storybook/addon-themes`.
