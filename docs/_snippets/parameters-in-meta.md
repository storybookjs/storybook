<!-- Vet this example for the inclusion of the addons in the preview  -->

```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    //👇 Creates specific parameters at the component level
    parameters: {
      backgrounds: {
        default: 'dark',
      },
    },
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    //👇 Creates specific parameters at the component level
    parameters: {
      backgrounds: {
        default: 'dark',
      },
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    //👇 Creates specific parameters at the component level
    parameters: {
      backgrounds: {
        default: 'dark',
      },
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
});
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
  //👇 Creates specific parameters at the component level
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

export default meta;
```
