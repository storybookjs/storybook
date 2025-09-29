```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
import React, { useCallback } from 'react';
import { OutlineIcon } from '@storybook/icons';
import { useGlobals } from 'storybook/manager-api';
import { addons } from 'storybook/preview-api';
import { IconButton } from 'storybook/internal/components';
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
    <IconButton
      key="Example"
      active={isActive}
      title="Show the toolbar addon"
      onClick={toggleToolbarAddon}
    >
      <OutlineIcon />
    </IconButton>
  );
};
```
