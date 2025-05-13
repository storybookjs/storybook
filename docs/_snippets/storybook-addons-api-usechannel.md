```js filename="my-addon/manager.js|ts" renderer="common" language="js"
import React from 'react';
import { useChannel } from 'storybook/manager-api';
import { AddonPanel, Button } from 'storybook/internal/components';
import { STORY_CHANGED } from 'storybook/internal/core-events';

export const Panel = () => {
  // Creates a Storybook API channel and subscribes to the STORY_CHANGED event
  const emit = useChannel({
    STORY_CHANGED: (...args) => console.log(...args),
  });

  return (
    <AddonPanel key="custom-panel" active="true">
      <Button onClick={() => emit('my-event-type', { sampleData: 'example' })}>
        Emit a Storybook API event with custom data
      </Button>
    </AddonPanel>
  );
};
```
