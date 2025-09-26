```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

const meta: Meta<Button> = {
  component: Button,
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          ArrowUp: 'Up',
          ArrowDown: 'Down',
          ArrowLeft: 'Left',
          ArrowRight: 'Right',
        },
      },
    },
  },
};

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

  const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

  const { Story } = defineMeta({
    component: Button,
    argTypes: {
      arrow: {
        options: Object.keys(arrows), // An array of serializable values
        mapping: arrows, // Maps serializable option values to complex arg values
        control: {
          type: 'select', // Type 'select' is automatically inferred when 'options' is defined
          labels: {
            // 'labels' maps option values to string labels
            ArrowUp: 'Up',
            ArrowDown: 'Down',
            ArrowLeft: 'Left',
            ArrowRight: 'Right',
          },
        },
      },
    },
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

export default {
  component: Button,
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          ArrowUp: 'Up',
          ArrowDown: 'Down',
          ArrowLeft: 'Left',
          ArrowRight: 'Right',
        },
      },
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Button } from './Button';

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

export default {
  component: Button,
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          ArrowUp: 'Up',
          ArrowDown: 'Down',
          ArrowLeft: 'Left',
          ArrowRight: 'Right',
        },
      },
    },
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

  const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

  const { Story } = defineMeta({
    component: Button,
    argTypes: {
      arrow: {
        options: Object.keys(arrows), // An array of serializable values
        mapping: arrows, // Maps serializable option values to complex arg values
        control: {
          type: 'select', // Type 'select' is automatically inferred when 'options' is defined
          labels: {
            // 'labels' maps option values to string labels
            ArrowUp: 'Up',
            ArrowDown: 'Down',
            ArrowLeft: 'Left',
            ArrowRight: 'Right',
          },
        },
      },
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';

import Button from './Button.svelte';

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

const meta = {
  component: Button,
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          ArrowUp: 'Up',
          ArrowDown: 'Down',
          ArrowLeft: 'Left',
          ArrowRight: 'Right',
        },
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

const meta = {
  component: Button,
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          ArrowUp: 'Up',
          ArrowDown: 'Down',
          ArrowLeft: 'Left',
          ArrowRight: 'Right',
        },
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

export default {
  component: 'demo-button',
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          ArrowUp: 'Up',
          ArrowDown: 'Down',
          ArrowLeft: 'Left',
          ArrowRight: 'Right',
        },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

const meta: Meta = {
  component: 'demo-button',
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          ArrowUp: 'Up',
          ArrowDown: 'Down',
          ArrowLeft: 'Left',
          ArrowRight: 'Right',
        },
      },
    },
  },
};

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

const meta = preview.meta({
  component: Button,
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          ArrowUp: 'Up',
          ArrowDown: 'Down',
          ArrowLeft: 'Left',
          ArrowRight: 'Right',
        },
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { Button } from './Button';

import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

const meta = preview.meta({
  component: Button,
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
        labels: {
          // 'labels' maps option values to string labels
          ArrowUp: 'Up',
          ArrowDown: 'Down',
          ArrowLeft: 'Left',
          ArrowRight: 'Right',
        },
      },
    },
  },
});
```
