```js filename=".storybook/manager.js" renderer="common" language="js"
import { addons } from 'storybook/manager-api';

import startCase from 'lodash/startCase.js';

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }, api, { location }) => {
      // Customize how the label renders on the mobile bottom bar with `location`.
      return type === 'story' || location === 'bottom-bar' ? name : startCase(name);
    },
    renderAriaLabel: ({ name, type }, api, { location }) => {
      // Announced by screen readers in place of the visual label.
      return type === 'story' && location === 'bottom-bar' ? `Current story: ${name}` : name;
    },
  },
});
```
