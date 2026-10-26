```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js" tabTitle="Without globals API"
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts" tabTitle="Without globals API"
import type { Meta } from 'storybook-solidjs-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

import preview from '../.storybook/preview';

import { MyComponent } from './my-component.component';

const meta = preview.meta({
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/angular';

import { INITIAL_VIEWPORTS } from 'storybook/viewport';

import { MyComponent } from './my-component.component';

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

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
});
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import { INITIAL_VIEWPORTS } from 'storybook/viewport';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    component: MyComponent,
    parameters: {
      viewport: {
        //👇 Set available viewports for every story in the file
        options: INITIAL_VIEWPORTS,
      },
    },
  });
</script>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { INITIAL_VIEWPORTS } from 'storybook/viewport';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
    parameters: {
      viewport: {
        //👇 Set available viewports for every story in the file
        options: INITIAL_VIEWPORTS,
      },
    },
  });
</script>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import { INITIAL_VIEWPORTS } from 'storybook/viewport';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    component: MyComponent,
    parameters: {
      viewport: {
        //👇 Set available viewports for every story in the file
        options: INITIAL_VIEWPORTS,
      },
    },
  });
</script>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { INITIAL_VIEWPORTS } from 'storybook/viewport';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
    parameters: {
      viewport: {
        //👇 Set available viewports for every story in the file
        options: INITIAL_VIEWPORTS,
      },
    },
  });
</script>
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/vue3-vite';

import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
  parameters: {
    viewport: {
      //👇 Set available viewports for every story in the file
      options: INITIAL_VIEWPORTS,
    },
  },
});
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/web-components-vite';

import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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
