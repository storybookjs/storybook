```js filename="my-addon/manager.js|ts" renderer="common" language="js"
import React, { useEffect, useCallback } from 'react';

import { useGlobals, useStorybookApi } from 'storybook/manager-api';
import { ToggleButton } from 'storybook/internal/components';
import { ChevronDownIcon } from '@storybook/icons';

export const Panel = () => {
  const [globals, updateGlobals] = useGlobals();
  const api = useStorybookApi();

  const isActive = [true, 'true'].includes(globals[PARAM_KEY]);

  const toggleMyTool = useCallback(() => {
    updateGlobals({
      [PARAM_KEY]: !isActive,
    });
  }, [isActive]);

  useEffect(() => {
    api.setAddonShortcut('custom-toolbar-addon', {
      label: 'Enable my addon',
      defaultShortcut: ['G'],
      actionName: 'Toggle',
      showInMenu: false,
      action: toggleMyTool,
    });
  }, [api]);

  return (
    <ToggleButton
      padding="small"
      variant="ghost"
      key="custom-toolbar"
      pressed={isActive}
      ariaLabel="My addon"
      tooltip="Enable my addon"
      onClick={toggleMyTool}
    >
      <ChevronDownIcon />
    </ToggleButton>
  );
};
```
