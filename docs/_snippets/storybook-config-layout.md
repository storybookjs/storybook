```js filename=".storybook/manager.js" renderer="common" language="js"
import { addons } from 'storybook/manager-api';

addons.setConfig({
  layout: {
    navSize: 300,
    bottomPanelHeight: 300,
    rightPanelWidth: 300,
    panelPosition: 'bottom',
    showToolbar: true,
    initialActive: 'sidebar',
  },
  ui: {
    enableShortcuts: true,
  },
  theme: undefined,
  selectedPanel: undefined,
  layoutCustomisations: {
    showSidebar(state, defaultValue) {
      return state.storyId === 'landing' ? false : defaultValue;
    },
    showToolbar(state, defaultValue) {
      return state.viewMode === 'docs' ? false : defaultValue;
    },
  },
  sidebar: {
    showRoots: false,
    collapsedRoots: ['other'],
  },
  toolbar: {
    title: { hidden: false },
    zoom: { hidden: false },
    eject: { hidden: false },
    copy: { hidden: false },
    fullscreen: { hidden: false },
  },
});
```

```ts filename=".storybook/manager.ts" renderer="common" language="ts"
import { addons, type State } from 'storybook/manager-api';

addons.setConfig({
  layout: {
    navSize: 300,
    bottomPanelHeight: 300,
    rightPanelWidth: 300,
    panelPosition: 'bottom',
    showToolbar: true,
    initialActive: 'sidebar',
  },
  ui: {
    enableShortcuts: true,
  },
  theme: undefined,
  selectedPanel: undefined,
  layoutCustomisations: {
    showSidebar(state: State, defaultValue: boolean) {
      return state.storyId === 'landing' ? false : defaultValue;
    },
    showToolbar(state: State, defaultValue: boolean) {
      return state.viewMode === 'docs' ? false : defaultValue;
    },
  },
  sidebar: {
    showRoots: false,
    collapsedRoots: ['other'],
  },
  toolbar: {
    title: { hidden: false },
    zoom: { hidden: false },
    eject: { hidden: false },
    copy: { hidden: false },
    fullscreen: { hidden: false },
  },
});
```
