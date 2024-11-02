```js filename="./storybook/manager.js" renderer="common" language="js"
import { addons } from '@storybook/manager-api';

addons.setConfig({
  layoutCustomisations: {
    // Hide the sidebar on the landing page, which has its own nav links to other pages.
    showSidebar(state: State, defaultValue: boolean) {
      if (state.storyId === 'landing') {
        return false;
      }

      return defaultValue;
    },
  },
});
```