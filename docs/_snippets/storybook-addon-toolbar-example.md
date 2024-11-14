```js filename="addon-toolbar/manager.js" renderer="common" language="js"
import React from 'react';

import { addons, types } from '@storybook/manager-api';

import { Icons, IconButton } from '@storybook/components';

addons.register('my/toolbar', () => {
  addons.add('my-toolbar-addon/toolbar', {
    title: 'Example Storybook toolbar',
    //👇 Sets the type of UI element in Storybook
    type: types.TOOL,
    //👇 Shows the Toolbar UI element if either the Canvas or Docs tab is active
    match: ({ viewMode }) => !!(viewMode && viewMode.match(/^(story|docs)$/)),
    render: ({ active }) => (
      <IconButton active={active} title="Show a Storybook toolbar">
        <Icons icon="outline" />
      </IconButton>
    ),
  });
});
```
