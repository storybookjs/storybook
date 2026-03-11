```tsx filename="src/Tool.tsx" renderer="common" language="ts"
import React, { memo, useCallback, useEffect } from 'react';

import { useGlobals, useStorybookApi } from 'storybook/manager-api';
import { ToggleButton } from 'storybook/internal/components';
import { LightningIcon } from '@storybook/icons';

import { ADDON_ID, PARAM_KEY, TOOL_ID } from './constants';

export const Tool = memo(function MyAddonSelector() {
  const [globals, updateGlobals] = useGlobals();
  const api = useStorybookApi();

  const isActive = [true, 'true'].includes(globals[PARAM_KEY]);

  const toggleMyTool = useCallback(() => {
    updateGlobals({
      [PARAM_KEY]: !isActive,
    });
  }, [isActive]);

  useEffect(() => {
    api.setAddonShortcut(ADDON_ID, {
      label: 'Toggle Addon [8]',
      defaultShortcut: ['8'],
      actionName: 'myaddon',
      showInMenu: false,
      action: toggleMyTool,
    });
  }, [toggleMyTool, api]);

  return (
    <ToggleButton
      padding="small"
      variant="ghost"
      key={TOOL_ID}
      pressed={isActive}
      ariaLabel="Addon feature"
      tooltip="Toggle addon feature"
      onClick={toggleMyTool}
    >
      <LightningIcon />
    </ToggleButton>
  );
});
```
