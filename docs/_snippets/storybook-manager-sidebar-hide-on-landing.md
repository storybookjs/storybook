```js filename="./storybook/manager.js" renderer="common" language="js"
import { addons } from '@storybook/manager-api';

addons.setConfig({
  layoutCustomisations: {
    // Hide the sidebar on the landing page, which has its own nav links to other pages.
    showSidebar(state, defaultValue) {
      if (state.storyId === 'landing' && state.viewMode === 'docs') {
        return false;
      }

      return defaultValue;
    },
  },
});
```

```ts filename="./storybook/manager.ts" renderer="common" language="ts"
import { addons, type State } from '@storybook/manager-api';

addons.setConfig({
  layoutCustomisations: {
    // Hide the sidebar on the landing page, which has its own nav links to other pages.
    showSidebar(state: State, defaultValue: boolean) {
      if (state.storyId === 'landing' && state.viewMode === 'docs') {
        return false;
      }

      return defaultValue;
    },
  },
});
```
