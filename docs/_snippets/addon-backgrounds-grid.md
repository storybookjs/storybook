```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

// To apply a set of backgrounds to all stories of Button:
const meta: Meta<Button> = {
  component: Button,
  parameters: {
    backgrounds: {
      grid: {
        cellSize: 20,
        opacity: 0.5,
        cellAmount: 5,
        offsetX: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
        offsetY: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
      },
    },
  },
};

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  // To apply a set of backgrounds to all stories of Button:
  const { Story } = defineMeta({
    component: Button,
    parameters: {
      backgrounds: {
        grid: {
          cellSize: 20,
          opacity: 0.5,
          cellAmount: 5,
          offsetX: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
          offsetY: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
        },
      },
    },
  });
</script>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  // To apply a set of backgrounds to all stories of Button:
  const { Story } = defineMeta({
    component: Button,
    parameters: {
      backgrounds: {
        grid: {
          cellSize: 20,
          opacity: 0.5,
          cellAmount: 5,
          offsetX: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
          offsetY: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
        },
      },
    },
  });
</script>
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

// To apply a grid to all stories of Button:
export default {
  component: Button,
  parameters: {
    backgrounds: {
      grid: {
        cellSize: 20,
        opacity: 0.5,
        cellAmount: 5,
        offsetX: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
        offsetY: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
      },
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

// To apply a set of backgrounds to all stories of Button:
const meta = {
  component: Button,
  parameters: {
    backgrounds: {
      grid: {
        cellSize: 20,
        opacity: 0.5,
        cellAmount: 5,
        offsetX: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
        offsetY: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
// To apply a set of backgrounds to all stories of Button:
export default {
  component: 'demo-button',
  parameters: {
    backgrounds: {
      grid: {
        cellSize: 20,
        opacity: 0.5,
        cellAmount: 5,
        offsetX: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
        offsetY: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

// To apply a set of backgrounds to all stories of Button:
const meta: Meta = {
  component: 'demo-button',
  parameters: {
    backgrounds: {
      grid: {
        cellSize: 20,
        opacity: 0.5,
        cellAmount: 5,
        offsetX: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
        offsetY: 16, // Default is 0 if story has 'fullscreen' layout, 16 if layout is 'padded'
      },
    },
  },
};

export default meta;
```
