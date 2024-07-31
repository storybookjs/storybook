```js filename="addon-toolbar/manager.js" renderer="common" language="js"
import React from 'react';

import { addons, types } from '@storybook/manager-api';
import { IconButton } from '@storybook/components';
import { OutlineIcon } from '@storybook/icons';

addons.register('my-addon', () => {
  addons.add('my-addon/toolbar', {
    title: 'Example Storybook toolbar',
    //👇 Sets the type of UI element in Storybook
    type: types.TOOL,
    //👇 Shows the Toolbar UI element if the story canvas is being viewed
    match: ({ tabId, viewMode }) => !tabId && viewMode === 'story',
    render: ({ active }) => (
      <IconButton active={active} title="Show a Storybook toolbar">
        <OutlineIcon />
      </IconButton>
    ),
  });
});
```

