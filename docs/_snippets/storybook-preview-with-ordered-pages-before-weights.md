```js filename=".storybook/preview.js" renderer="common" language="js"
export default {
  parameters: {
    options: {
      storySort: {
        order: [
          'Intro',
          'Pages',
          [
            'Intro',
            'Home',
            ['Intro', '*', 'WIP'],
            'Login',
            ['Intro', '*', 'WIP'],
            'Admin',
            ['Intro', '*', 'WIP'],
            '*',
            ['Intro', '*', 'WIP'],
            'WIP',
          ],
          'Components',
          ['Intro', '*', 'WIP'],
          '*',
          'WIP',
        ],
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        order: [
          'Intro',
          'Pages',
          [
            'Intro',
            'Home',
            ['Intro', '*', 'WIP'],
            'Login',
            ['Intro', '*', 'WIP'],
            'Admin',
            ['Intro', '*', 'WIP'],
            '*',
            ['Intro', '*', 'WIP'],
            'WIP',
          ],
          'Components',
          ['Intro', '*', 'WIP'],
          '*',
          'WIP',
        ],
      },
    },
  },
};

export default preview;
```

