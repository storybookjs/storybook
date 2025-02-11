```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<Button>;

export const Basic: Story = {
  render: () => ({
    template: `<app-button>hello</<app-button>`,
  }),
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export const Basic = {
  render: () => <Button>Hello</Button>,
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
});

export const Basic = meta.story({
  render: () => <Button>Hello</Button>,
});
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => <Button>Hello</Button>,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
});

export const Basic = meta.story({
  render: () => <Button>Hello</Button>,
});
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Basic: Story = {
  render: () => <Button>Hello</Button>,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
});

export const Basic = meta.story({
  render: () => <Button>Hello</Button>,
});
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export const Basic = {
  render: () => <Button>Hello</Button>,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => <Button>Hello</Button>,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Basic: Story = {
  render: () => <Button>Hello</Button>,
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    parameters: {
      myAddon: {
        data: 'This data is passed to the addon',
      },
    },
  });
</script>

<Story name="Basic"/>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
};

export const Basic = {};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    parameters: {
      myAddon: {
        data: 'This data is passed to the addon',
      },
    },
  });
</script>

<Story name="Basic"/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    parameters: {
      myAddon: {
        data: 'This data is passed to the addon',
      },
    },
  });
</script>

<Story name="Basic"/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'this data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export const Basic = {
  render: () => ({
    components: { Button },
    template: '<Button label="Hello" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => ({
    components: { Button },
    template: '<Button label="Hello" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Basic: Story = {
  render: () => ({
    components: { Button },
    template: '<Button label="Hello" />',
  }),
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'custom-button',
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export const Basic = {
  render: () => html`<custom-button label="Hello"></custom-button>`,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

const meta: Meta = {
  component: 'custom-button',
  //👇 Creates specific parameters for the story
  parameters: {
    myAddon: {
      data: 'This data is passed to the addon',
    },
  },
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => html`<custom-button label="Hello"></custom-button>`,
};
```
