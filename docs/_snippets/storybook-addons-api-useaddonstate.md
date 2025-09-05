```js filename="my-addon/manager.js|ts" renderer="common" language="js"
import React from 'react';

import { useAddonState } from 'storybook/manager-api';
import { AddonPanel, Button, ToggleButton } from 'storybook/internal/components';
import { LightningIcon } from '@storybook/icons';

export const Panel = () => {
  const [state, setState] = useAddonState('addon-unique-identifier', 'initial state');

  return (
    <AddonPanel key="custom-panel" active="true">
      <Button ariaLabel={false} onClick={() => setState('Example')}>
        Click to update Storybook's internal state
      </Button>
    </AddonPanel>
  );
};
export const Tool = () => {
  const [state, setState] = useAddonState('addon-unique-identifier', 'initial state');

  return (
    <ToggleButton
      padding="small"
      variant="ghost"
      key="custom-toolbar"
      pressed="true"
      ariaLabel="Enable my addon"
      onClick={() => setState('Example')}
    >
      <LightningIcon />
    </ToggleButton>
  );
};
```
