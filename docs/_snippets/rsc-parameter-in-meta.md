```js filename="MyServerComponent.stories.js" renderer="react" language="js" tabTitle="CSF (Legacy)"
import MyServerComponent from './MyServerComponent';

export default {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
};
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF (Legacy)"
// Replace your-framework with nextjs or nextjs-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import MyServerComponent from './MyServerComponent';

const meta = {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
} satisfies Meta<typeof MyServerComponent>;
export default meta;
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF"
import preview from '../.storybook/preview';

import MyServerComponent from './MyServerComponent';

const meta = preview.meta({
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyServerComponent.stories.js" renderer="react" language="js" tabTitle="CSF"
import preview from '../.storybook/preview';

import MyServerComponent from './MyServerComponent';

const meta = preview.meta({
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
});
```
