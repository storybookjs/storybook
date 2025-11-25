```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
import React, { useCallback } from 'react';
import { OutlineIcon } from '@storybook/icons';
import { useGlobals } from 'storybook/manager-api';
import { addons } from 'storybook/preview-api';
import { ToggleButton } from 'storybook/internal/components';
import { FORCE_RE_RENDER } from 'storybook/internal/core-events';

const ExampleToolbar = () => {
  const [globals, updateGlobals] = useGlobals();

  const isActive = globals['my-param-key'] || false;

  // Function that will update the global value and trigger a UI refresh.
  const refreshAndUpdateGlobal = () => {
    updateGlobals({
      ['my-param-key']: !isActive,
    }),
      // Invokes Storybook's addon API method (with the FORCE_RE_RENDER) event to trigger a UI refresh
      addons.getChannel().emit(FORCE_RE_RENDER);
  };

  const toggleToolbarAddon = useCallback(() => refreshAndUpdateGlobal(), [isActive]);

  return (
    <ToggleButton
      key="Example"
      padding="small"
      variant="ghost"
      pressed={isActive}
      onClick={toggleToolbarAddon}
      ariaLabel="Addon feature"
      tooltip="Toggle addon feature"
    >
      <OutlineIcon />
    </ToggleButton>
  );
};
```
