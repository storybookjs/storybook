```js filename=".storybook/manager.js" renderer="common" language="js"
import { addons } from '@storybook/manager-api';
import yourTheme from './YourTheme';

addons.setConfig({
  theme: yourTheme,
});
```
