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
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
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

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
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

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

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

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

```js filename="MyComponent.stories.js" renderer="vue" language="js"
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

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

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

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
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

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

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

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

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
