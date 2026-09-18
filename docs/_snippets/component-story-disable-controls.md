```ts filename="YourComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta } from '@storybook/angular';

import { YourComponent } from './your-component.component';

const meta: Meta<YourComponent> = {
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
};

export default meta;
```

```ts filename="YourComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { YourComponent } from './your-component.component';

const meta = preview.meta({
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
});
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    argTypes: {
      // foo is the property we want to remove from the UI
      foo: {
        table: {
          disable: true,
        },
      },
    },
  });
</script>
```

```js filename="YourComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF 3"
import YourComponent from './YourComponent.svelte';

export default {
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
};
```

```js filename="YourComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { YourComponent } from './YourComponent';

export default {
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    argTypes: {
      // foo is the property we want to remove from the UI
      foo: {
        table: {
          disable: true,
        },
      },
    },
  });
</script>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF 3"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';

import YourComponent from './YourComponent.svelte';

const meta = {
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```ts filename="YourComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { YourComponent } from './YourComponent';

const meta = {
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof YourComponent>;

export default meta;
```

```js filename="YourComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  component: 'your-component',
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
};
```

```ts filename="YourComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'your-component',
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
};

export default meta;
```

```js filename="YourComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'your-component',
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
});
```

```ts filename="YourComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'your-component',
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
});
```

```ts filename="YourComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { YourComponent } from './YourComponent';

const meta = preview.meta({
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="YourComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { YourComponent } from './YourComponent';

const meta = preview.meta({
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
});
```

```ts filename="YourComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import YourComponent from './YourComponent.vue';

const meta = preview.meta({
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="YourComponent.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import YourComponent from './YourComponent.vue';

const meta = preview.meta({
  component: YourComponent,
  argTypes: {
    // foo is the property we want to remove from the UI
    foo: {
      table: {
        disable: true,
      },
    },
  },
});
```
