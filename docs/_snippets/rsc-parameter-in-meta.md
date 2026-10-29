```js filename="MyServerComponent.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import MyServerComponent from './MyServerComponent';

const meta = preview.meta({
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
});
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import MyServerComponent from './MyServerComponent';

const meta = preview.meta({
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
});
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```js filename="MyServerComponent.stories.js" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import MyServerComponent from './MyServerComponent';

export default {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
};
```
