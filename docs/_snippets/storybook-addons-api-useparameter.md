```js filename="my-addon/manager.js|ts" renderer="common" language="js"
import React from 'react';

import { AddonPanel } from '@storybook/components';

import { useParameter } from '@storybook/manager-api';

export const Panel = () => {
  // Connects to Storybook's API and retrieves the value of the custom parameter for the current story
  const value = useParameter('custom-parameter', 'initial value');

  return (
    <AddonPanel key="custom-panel" active="true">
      {value === 'initial value' ? (
        <h2>The story doesn't contain custom parameters. Defaulting to the initial value.</h2>
      ) : (
        <h2>You've set {value} as the parameter.</h2>
      )}
    </AddonPanel>
  );
};
```

