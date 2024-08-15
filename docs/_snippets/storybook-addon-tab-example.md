```js filename="addon-tab/manager.js" renderer="common" language="js"
import React from 'react';

import { addons, types } from '@storybook/manager-api';

addons.register('my-addon', () => {
  addons.add('my-addon/tab', {
    type: types.TAB,
    title: 'Example Storybook tab',
    render: () => (
      <div>
        <h2>I'm a tabbed addon in Storybook</h2>
      </div>
    ),
  });
});
```

