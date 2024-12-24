```tsx filename="src/Tool.tsx" renderer="common" language="ts" tabTitle="Toolbar"
import React, { memo, useCallback, useEffect } from 'react';

import { useGlobals, useStorybookApi } from '@storybook/manager-api';
import { IconButton } from '@storybook/components';
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
      label: 'Toggle Measure [O]',
      defaultShortcut: ['O'],
      actionName: 'outline',
      showInMenu: false,
      action: toggleMyTool,
    });
  }, [toggleMyTool, api]);

  return (
    <IconButton key={TOOL_ID} active={isActive} title="Enable my addon" onClick={toggleMyTool}>
      <LightningIcon />
    </IconButton>
  );
});
```

```tsx filename="src/Panel.tsx" renderer="common" language="ts" tabTitle="Panel"
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

```tsx filename="src/Tab.tsx" renderer="common" language="ts" tabTitle="Tab"
import React from 'react';

import { useParameter } from '@storybook/manager-api';

import { PARAM_KEY } from './constants';

// See https://github.com/storybookjs/addon-kit/blob/main/src/components/TabContent.tsx for an example of a TabContent component
import { TabContent } from './components/TabContent';

interface TabProps {
  active: boolean;
}

export const Tab: React.FC<TabProps> = ({ active }) => {
  // https://storybook.js.org/docs/addons/addons-api#useparameter
  const paramData = useParameter<string>(PARAM_KEY, '');

  return active ? <TabContent code={paramData} /> : null;
};
```
