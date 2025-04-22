```js filename="MyServerComponent.stories.js" renderer="react" language="js"
import MyServerComponent from './MyServerComponent';

export default {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
};
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import MyServerComponent from './MyServerComponent';

const meta = {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
} satisfies Meta<typeof MyServerComponent>;
export default meta;
```
