```ts filename="my-addon/src/store.ts" renderer="common" language="ts" tabTitle="Store"
import type { SetStateAction } from 'react';
import { useSyncExternalStore } from 'react';

interface MyAddonState {
  enabled: boolean;
}

let state: MyAddonState = { enabled: false };
const listeners = new Set<() => void>();

export const myAddonStore = {
  get: () => state,
  set: (next: SetStateAction<MyAddonState>) => {
    state = typeof next === 'function' ? next(state) : next;
    listeners.forEach((listener) => listener());
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const useMyAddonState = () => useSyncExternalStore(myAddonStore.subscribe, myAddonStore.get);
```

```tsx filename="my-addon/src/Panel.tsx" renderer="common" language="ts" tabTitle="Panel"
import React from 'react';

import { AddonPanel, Button } from 'storybook/internal/components';

import { myAddonStore, useMyAddonState } from './store';

export const Panel = () => {
  const { enabled } = useMyAddonState();

  return (
    <AddonPanel key="custom-panel" active>
      <Button ariaLabel={false} onClick={() => myAddonStore.set({ enabled: !enabled })}>
        {enabled ? 'Disable' : 'Enable'} my addon
      </Button>
    </AddonPanel>
  );
};
```

```tsx filename="my-addon/src/Tool.tsx" renderer="common" language="ts" tabTitle="Toolbar"
import React from 'react';

import { ToggleButton } from 'storybook/internal/components';
import { LightningIcon } from '@storybook/icons';

import { myAddonStore, useMyAddonState } from './store';

export const Tool = () => {
  const { enabled } = useMyAddonState();

  return (
    <ToggleButton
      padding="small"
      variant="ghost"
      key="custom-toolbar"
      pressed={enabled}
      ariaLabel="Enable my addon"
      onClick={() => myAddonStore.set({ enabled: !enabled })}
    >
      <LightningIcon />
    </ToggleButton>
  );
};
```
