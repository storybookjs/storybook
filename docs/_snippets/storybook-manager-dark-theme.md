```js filename=".storybook/manager.js" renderer="common" language="js"
import { addons } from '@storybook/manager-api';
import { themes } from '@storybook/theming';

addons.setConfig({
  theme: themes.dark,
});
```
