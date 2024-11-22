```js filename=".storybook/manager.js" renderer="common" language="js"
import { addons } from '@storybook/manager-api';

addons.setConfig({
  navSize: 300,
  bottomPanelHeight: 300,
  rightPanelWidth: 300,
  panelPosition: 'bottom',
  enableShortcuts: true,
  showToolbar: true,
  theme: undefined,
  selectedPanel: undefined,
  initialActive: 'sidebar',
  layoutCustomisations: {
    showSidebar(state, defaultValue) {
      return (state.storyId === 'landing') ? false : defaultValue;
    },
    showToolbar(state, defaultValue) {
      return (state.viewMode === 'docs') ? false : defaultValue;
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

