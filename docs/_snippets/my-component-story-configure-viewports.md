```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
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
  render: () => ({
    template: '<MyComponent></MyComponent>',
  }),
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js"
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

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
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

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts"
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

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
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

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts-4-9"
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

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
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

```js filename="MyComponent.stories.js" renderer="svelte" language="js"
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

```html renderer="svelte" language="ts" tabTitle="native-format"
{/* MyComponent.stories.svelte */}

<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';

  import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

  import MyComponent from './MyComponent.svelte';
</script>

<Meta title="MyComponent" component={MyComponent} parameters={{ //👇 The viewports object from the
Essentials addon viewport: { //👇 The viewports you want to use viewports: INITIAL_VIEWPORTS, //👇
Your own default viewport defaultViewport: 'iphone6', }, }} />

<template let:args>
  <MyComponent {...args} />
</template>

<Story name="MyStory" parameters={{ viewport: { defaultViewport: 'iphonex', }, }} />
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9"
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

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts"
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

```js filename="MyComponent.stories.js" renderer="vue" language="js"
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

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9"
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

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
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

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
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

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
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

