```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './button.component';

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

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

const arrows = {
  Up: html`<icon-arrow-up></icon-arrow-up>`,
  Down: html`<icon-arrow-down></icon-arrow-down>`,
  Left: html`<icon-arrow-left></icon-arrow-left>`,
  Right: html`<icon-arrow-right></icon-arrow-right>`,
};

const meta = preview.meta({
  component: 'demo-button',
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
      },
    },
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

  const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

  const { Story } = preview.meta({
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

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

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

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

const arrows = {
  Up: html`<icon-arrow-up></icon-arrow-up>`,
  Down: html`<icon-arrow-down></icon-arrow-down>`,
  Left: html`<icon-arrow-left></icon-arrow-left>`,
  Right: html`<icon-arrow-right></icon-arrow-right>`,
};

const meta = preview.meta({
  component: 'demo-button',
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
      },
    },
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from './icons';

  const arrows = { ArrowUp, ArrowDown, ArrowLeft, ArrowRight };

  const { Story } = preview.meta({
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

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

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

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
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

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
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

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Button from './Button.vue';

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

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Button from './Button.vue';

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

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { html } from 'lit';

import type { Meta } from '@storybook/web-components-vite';

const arrows = {
  Up: html`<icon-arrow-up></icon-arrow-up>`,
  Down: html`<icon-arrow-down></icon-arrow-down>`,
  Left: html`<icon-arrow-left></icon-arrow-left>`,
  Right: html`<icon-arrow-right></icon-arrow-right>`,
};

const meta: Meta = {
  component: 'demo-button',
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
      },
    },
  },
};

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { html } from 'lit';

const arrows = {
  Up: html`<icon-arrow-up></icon-arrow-up>`,
  Down: html`<icon-arrow-down></icon-arrow-down>`,
  Left: html`<icon-arrow-left></icon-arrow-left>`,
  Right: html`<icon-arrow-right></icon-arrow-right>`,
};

export default {
  component: 'demo-button',
  argTypes: {
    arrow: {
      options: Object.keys(arrows), // An array of serializable values
      mapping: arrows, // Maps serializable option values to complex arg values
      control: {
        type: 'select', // Type 'select' is automatically inferred when 'options' is defined
      },
    },
  },
};
```
