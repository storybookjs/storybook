```js filename="my-addon/manager.js|ts" renderer="common" language="js"
import React, { useEffect, useCallback } from 'react';

import { Icons, IconButton } from '@storybook/components';

import { useStorybookApi } from '@storybook/manager-api';

export const Panel = () => {
  const api = useStorybookApi();

  const toggleMyTool = useCallback(() => {
    // Custom logic to toggle the addon here
  }, []);

  useEffect(() => {
    api.setAddonShortcut('custom-toolbar-addon', {
      label: 'Enable toolbar addon',
      defaultShortcut: ['G'],
      actionName: 'Toggle',
      showInMenu: false,
      action: toggleAddon,
    });
  }, [api]);

  return (
    <IconButton key="custom-toolbar" active="true" title="Show a toolbar addon">
      <Icons icon="arrowdown" />
    </IconButton>
  );
};
```
