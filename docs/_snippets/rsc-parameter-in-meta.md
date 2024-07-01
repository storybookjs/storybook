```js filename="MyServerComponent.stories.js" renderer="react" language="js"
import MyServerComponent from './MyServerComponent';

export default {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
};
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts-4-9"
import { Meta, StoryObj } from '@storybook/react';

import MyServerComponent from './MyServerComponent';

const meta = {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
} satisfies Meta<typeof MyServerComponent>;
export default meta;
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts"
import { Meta, StoryObj } from '@storybook/react';

import MyServerComponent from './MyServerComponent';

const meta: Meta<typeof MyServerComponent> = {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
};
export default meta;
```

