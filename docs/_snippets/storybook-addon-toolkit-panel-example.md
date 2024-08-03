```tsx filename="src/Panel.tsx" renderer="common" language="ts" tabTitle="panel"
import React from 'react';

import { useAddonState, useChannel } from '@storybook/manager-api';
import { AddonPanel } from '@storybook/components';
import { ADDON_ID, EVENTS } from './constants';

// See https://github.com/storybookjs/addon-kit/blob/main/src/components/PanelContent.tsx for an example of a PanelContent component
import { PanelContent } from './components/PanelContent';

interface PanelProps {
  active: boolean;
}

export const Panel: React.FC<PanelProps> = (props) => {
  // https://storybook.js.org/docs/addons/addons-api#useaddonstate
  const [results, setState] = useAddonState(ADDON_ID, {
    danger: [],
    warning: [],
  });

  // https://storybook.js.org/docs/addons/addons-api#usechannel
  const emit = useChannel({
    [EVENTS.RESULT]: (newResults) => setState(newResults),
  });

  return (
    <AddonPanel {...props}>
      <PanelContent
        results={results}
        fetchData={() => {
          emit(EVENTS.REQUEST);
        }}
        clearData={() => {
          emit(EVENTS.CLEAR);
        }}
      />
    </AddonPanel>
  );
};
```

