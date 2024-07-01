```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  parameters: {
    controls: {
      presetColors: [{ color: '#ff4785', title: 'Coral' }, 'rgba(0, 159, 183, 1)', '#fe4a49'],
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    controls: {
      presetColors: [{ color: '#ff4785', title: 'Coral' }, 'rgba(0, 159, 183, 1)', '#fe4a49'],
    },
  },
};

export default preview;
```

