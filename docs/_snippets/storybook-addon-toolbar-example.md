```js filename="addon-toolbar/manager.js" renderer="common" language="js"
import React from 'react';

import { addons, types } from 'storybook/manager-api';
import { ToggleButton } from 'storybook/internal/components';
import { OutlineIcon } from '@storybook/icons';

addons.register('my-addon', () => {
  addons.add('my-addon/toolbar', {
    title: 'Example Storybook toolbar',
    //👇 Sets the type of UI element in Storybook
    type: types.TOOL,
    //👇 Shows the Toolbar UI element if the story canvas is being viewed
    match: ({ tabId, viewMode }) => !tabId && viewMode === 'story',
    render: ({ active }) => (
      <ToggleButton
        key="Example"
        padding="small"
        variant="ghost"
        pressed={active}
        ariaLabel="Addon feature"
        tooltip="Toggle addon feature"
      >
        <OutlineIcon />
      </ToggleButton>
    ),
  });
});
```
