```tsx filename="src/Tool.tsx" renderer="common" language="ts" tabTitle="Toolbar"
import React, { memo, useCallback, useEffect } from 'react';

import { useGlobals, useStorybookApi } from 'storybook/manager-api';
import { ToggleButton } from 'storybook/internal/components';
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
      label: 'Toggle Outline',
      defaultShortcut: ['alt', 'O'],
      actionName: 'outline',
      showInMenu: false,
      action: toggleMyTool,
    });
  }, [toggleMyTool, api]);

  return (
    <ToggleButton
      padding="small"
      variant="ghost"
      key={TOOL_ID}
      pressed={isActive}
      ariaLabel="Addon feature"
      tooltip="Toggle addon feature"
      onClick={toggleMyTool}
    >
      <LightningIcon />
    </ToggleButton>
  );
});
```

```ts filename="src/store.ts" renderer="common" language="ts" tabTitle="Store"
import type { SetStateAction } from 'react';
import { useSyncExternalStore } from 'react';

interface Results {
  danger: string[];
  warning: string[];
}

let state: Results = { danger: [], warning: [] };
const listeners = new Set<() => void>();

export const resultsStore = {
  get: () => state,
  set: (next: SetStateAction<Results>) => {
    state = typeof next === 'function' ? next(state) : next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useResults = () => useSyncExternalStore(resultsStore.subscribe, resultsStore.get);
```

```tsx filename="src/Panel.tsx" renderer="common" language="ts" tabTitle="Panel"
import React from 'react';

import { useChannel } from 'storybook/manager-api';
import { AddonPanel } from 'storybook/internal/components';

import { EVENTS } from './constants';
import { resultsStore, useResults } from './store';

// See https://github.com/storybookjs/addon-kit/blob/main/src/components/PanelContent.tsx for an example of a PanelContent component
import { PanelContent } from './components/PanelContent';

interface PanelProps {
  active: boolean;
}

export const Panel: React.FC<PanelProps> = (props) => {
  // https://storybook.js.org/docs/addons/addons-api#addon-state
  const results = useResults();

  // https://storybook.js.org/docs/addons/addons-api#usechannel
  const emit = useChannel({
    [EVENTS.RESULT]: (newResults) => resultsStore.set(newResults),
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

import { useParameter } from 'storybook/manager-api';

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
