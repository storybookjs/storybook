```js filename="my-addon/manager.js|ts" renderer="common" language="js"
import React from 'react';

import { useAddonState } from '@storybook/manager-api';

import { AddonPanel, Button, IconButton } from '@storybook/components';

export const Panel = () => {
  const [state, setState] = useAddonState('addon-unique-identifier', 'initial state');

  return (
    <AddonPanel key="custom-panel" active="true">
      <Button onClick={() => setState('Example')}>
        Click to update Storybook's internal state
      </Button>
    </AddonPanel>
  );
};
export const Tool = () => {
  const [state, setState] = useAddonState('addon-unique-identifier', 'initial state');

  return (
    <IconButton
      key="custom-toolbar"
      active="true"
      title="Enable my addon"
      onClick={() => setState('Example')}
    >
      <Icons icon="lightning" />
    </IconButton>
  );
};
```
