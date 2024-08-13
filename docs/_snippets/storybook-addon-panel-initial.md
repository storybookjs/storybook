```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
import React from 'react';

import { addons, types } from '@storybook/manager-api';

import { AddonPanel } from '@storybook/components';

const ADDON_ID = 'myaddon';
const PANEL_ID = `${ADDON_ID}/panel`;

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'My Addon',
    render: ({ active, key }) => (
      <AddonPanel active={active} key={key}>
        <div> Storybook addon panel </div>
      </AddonPanel>
    ),
  });
});
```
