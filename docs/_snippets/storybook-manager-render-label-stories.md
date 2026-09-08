```js filename=".storybook/manager.js" renderer="common" language="js"
import { addons } from 'storybook/manager-api';

import startCase from 'lodash/startCase.js';

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }, api, { location }) => {
      return type === 'story' || location === 'bottom-bar' ? name : startCase(name);
    },
  },
});
```
