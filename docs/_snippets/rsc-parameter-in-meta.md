<!-- TODO: Vet this example for CSF Next support -->

```js filename="MyServerComponent.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import MyServerComponent from './MyServerComponent';

export default {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
};
```

```js filename="MyServerComponent.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import MyServerComponent from './MyServerComponent';

const meta = preview.meta({
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
});
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import MyServerComponent from './MyServerComponent';

const meta = {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
} satisfies Meta<typeof MyServerComponent>;
export default meta;
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import MyServerComponent from './MyServerComponent';

const meta = preview.meta({
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
});
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import MyServerComponent from './MyServerComponent';

const meta: Meta<typeof MyServerComponent> = {
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
};
export default meta;
```

```ts filename="MyServerComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import MyServerComponent from './MyServerComponent';

const meta = preview.meta({
  component: MyServerComponent,
  parameters: {
    react: { rsc: false },
  },
});
```
