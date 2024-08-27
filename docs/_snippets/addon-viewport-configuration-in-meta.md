```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="Without globals API"
import type { Meta, StoryObj } from '@storybook/angular';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="Without globals API"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="Without globals API"
import type { Meta, StoryObj } from '@storybook/react';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="Without globals API"
import type { Meta, StoryObj } from '@storybook/react';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js" tabTitle="Without globals API"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts-4-9" tabTitle="Without globals API"
import type { Meta, StoryObj } from 'storybook-solidjs';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts" tabTitle="Without globals API"
import type { Meta, StoryObj } from 'storybook-solidjs';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="Without globals API"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="Without globals API"
import type { Meta, StoryObj } from '@storybook/svelte';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="Without globals API"
import type { Meta, StoryObj } from '@storybook/svelte';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="Without globals API"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9" tabTitle="Without globals API"
import type { Meta, StoryObj } from '@storybook/vue3';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="Without globals API"
import type { Meta, StoryObj } from '@storybook/vue3';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="Without globals API"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

export default {
  component: 'my-component',
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="Without globals API"
import type { Meta, StoryObj } from '@storybook/web-components';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

const meta: Meta = {
  component: 'my-component',
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      viewports: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="With globals API"
import type { Meta, StoryObj } from '@storybook/angular';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="With globals API"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="With globals API"
import type { Meta, StoryObj } from '@storybook/react';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="With globals API"
import type { Meta, StoryObj } from '@storybook/react';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="With globals API"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="With globals API"
import type { Meta, StoryObj } from '@storybook/svelte';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="With globals API"
import type { Meta, StoryObj } from '@storybook/svelte';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.svelte';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="With globals API"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9" tabTitle="With globals API"
import type { Meta, StoryObj } from '@storybook/vue3';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="With globals API"
import type { Meta, StoryObj } from '@storybook/vue3';

import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import MyComponent from './MyComponent.vue';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="With globals API"
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

export default {
  component: 'my-component',
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="With globals API"
import type { Meta, StoryObj } from '@storybook/web-components';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

const meta: Meta = {
  component: 'my-component',
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
};

export default meta;
```
