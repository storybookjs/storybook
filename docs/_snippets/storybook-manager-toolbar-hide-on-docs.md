```js filename="./storybook/manager.js" renderer="common" language="js"
import { addons } from 'storybook/manager-api';

addons.setConfig({
  layoutCustomisations: {
    // Always hide the toolbar on docs pages, and respect user preferences elsewhere.
    showToolbar(state, defaultValue) {
      if (state.viewMode === 'docs') {
        return false;
      }

      return defaultValue;
    },
  },
});
```

```ts filename="./storybook/manager.ts" renderer="common" language="ts"
import { addons, type State } from 'storybook/manager-api';

addons.setConfig({
  layoutCustomisations: {
    // Always hide the toolbar on docs pages, and respect user preferences elsewhere.
    showToolbar(state: State, defaultValue: boolean) {
      if (state.viewMode === 'docs') {
        return false;
      }

      return defaultValue;
    },
  },
});
```
