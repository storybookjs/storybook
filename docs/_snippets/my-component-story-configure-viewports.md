```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/angular';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
type Story = StoryObj<MyComponent>;

export const MyStory: Story = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="globals-api"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
};

export const MyStory = {
  globals: {
    viewport: {
      //👇 Your own default viewport
      value: 'iphone6',
    },
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/react';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/react';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const MyStory: Story = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="globals-api"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
};

export const MyStory = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/svelte';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/svelte';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="globals-api"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
};

export const MyStory = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/vue3';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/vue3';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const MyStory: Story = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="globals-api"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

export default {
  component: 'my-component',
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
};

export const MyStory = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/web-components';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

const meta: Meta = {
  component: 'my-component',
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
type Story = StoryObj;

export const MyStory: Story = {
  globals: {
    viewport: {
      value: 'iphone6',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/angular';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,

      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export default meta;
type Story = StoryObj<MyComponent>;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="without-globals"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export const MyStory = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/react';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/react';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js" tabTitle="without-globals"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export const MyStory = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts-4-9" tabTitle="without-globals"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="without-globals"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export const MyStory = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/svelte';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/svelte';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="without-globals"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,

      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export const MyStory = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/vue3';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,

      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/vue3';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,

      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="without-globals"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

export default {
  component: 'my-component',
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export const MyStory = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/web-components';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

const meta: Meta = {
  component: 'my-component',
  parameters: {
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
      //👇 Your own default viewport
      defaultViewport: 'iphone6',
    },
  },
};

export default meta;
type Story = StoryObj;

export const MyStory: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'iphonex',
    },
  },
};
```
