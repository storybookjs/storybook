```js filename="my-addon/manager.js|ts" renderer="common" language="js"
import React, { useEffect, useCallback } from 'react';

import { useStorybookApi } from 'storybook/manager-api';
import { Button } from 'storybook/internal/components';
import { ChevronDownIcon } from '@storybook/icons';

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
    <Button
      padding="small"
      variant="ghost"
      key="custom-toolbar"
      active="true"
      ariaLabel="Show a toolbar addon"
    >
      <ChevronDownIcon />
    </Button>
  );
};
```
