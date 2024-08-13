```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
import React from 'react';

import { AddonPanel } from '@storybook/components';

import { useStorybookState } from '@storybook/manager-api';

export const Panel = () => {
  const state = useStorybookState();
  return (
    <AddonPanel {...props}>
      {state.viewMode !== 'docs' ? (
        <h2>Do something with the documentation</h2>
      ) : (
        <h2>Show the panel when viewing the story</h2>
      )}
    </AddonPanel>
  );
};
```
