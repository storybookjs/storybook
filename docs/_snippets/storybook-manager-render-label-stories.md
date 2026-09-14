```js filename=".storybook/manager.js" renderer="common" language="js"
import { addons } from 'storybook/manager-api';

import startCase from 'lodash/startCase.js';

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }, api, { location }) => {
      // Use `location` to change the label on the mobile bottom bar.
      return type === 'story' || location === 'bottom-bar' ? name : startCase(name);
    },
    renderAriaLabel: ({ name, type }, api, { location }) => {
      // Screen readers announce this string instead of the visual label.
      return type === 'story' && location === 'bottom-bar' ? `Current story: ${name}` : name;
    },
  },
});
```
