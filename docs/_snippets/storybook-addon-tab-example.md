```js filename="addon-tab/manager.js" renderer="common" language="js"
import React from 'react';

import { addons, types } from '@storybook/manager-api';

addons.register('my/tab', () => {
  addons.add('my-panel-addon/tab', {
    type: types.TAB,
    title: 'Example Storybook tab',
    //👇 Checks the current route for the story
    route: ({ storyId, refId }) => (refId ? `/mytab/${refId}_${storyId}` : `/mytab/${storyId}`),
    //👇 Shows the Tab UI element in mytab view mode
    match: ({ viewMode }) => viewMode === 'mytab',
    render: () => (
      <div>
        <h2>I'm a tabbed addon in Storybook</h2>
      </div>
    ),
  });
});
```
