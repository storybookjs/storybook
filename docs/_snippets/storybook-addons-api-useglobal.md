```js filename="my-addon/manager.js|ts" renderer="common" language="js"
import React from 'react';

import { AddonPanel, Button } from '@storybook/components';

import { useGlobals } from '@storybook/manager-api';

export const Panel = () => {
  const [globals, updateGlobals] = useGlobals();

  const isActive = globals['my-param-key'] || false; // 👈 Sets visibility based on the global value.

  return (
    <AddonPanel key="custom-panel" active={isActive}>
      <Button onClick={() => updateGlobals({ ['my-param-key']: !isActive })}>
        {isActive ? 'Hide the addon panel' : 'Show the panel'}
      </Button>
    </AddonPanel>
  );
};
```

