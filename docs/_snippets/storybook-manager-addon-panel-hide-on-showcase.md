```js filename="./storybook/manager.js" renderer="common" language="js"
import { addons } from 'storybook/manager-api';

addons.setConfig({
  layoutCustomisations: {
    showPanel(state, defaultValue) {
      const tags = state.index?.[state.storyId]?.tags ?? [];

      // Hide the panel on stories designed to showcase multiple variants or usage examples.
      if (tags.includes('showcase') || tags.includes('kitchensink')) {
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
    showPanel(state: State, defaultValue: boolean) {
      const tags = state.index?.[state.storyId]?.tags ?? [];

      // Hide the panel on stories designed to showcase multiple variants or usage examples.
      if (tags.includes('showcase') || tags.includes('kitchensink')) {
        return false;
      }

      return defaultValue;
    },
  },
});
```
