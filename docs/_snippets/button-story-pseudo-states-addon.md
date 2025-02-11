<!-- Vet this example for CSF Next support (pseudo states addon) -->

```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => ({
    template: `<app-button>Label</<app-button>`,
  }),
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

export const Hover = {
  parameters: { pseudo: { hover: true } },
  render: () => <Button>Label</Button>,
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Hover = meta.story({
  parameters: { pseudo: { hover: true } },
  render: () => <Button>Label</Button>,
});
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => <Button>Label</Button>,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Hover = meta.story({
  parameters: { pseudo: { hover: true } },
  render: () => <Button>Label</Button>,
});
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => <Button>Label</Button>,
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Hover = meta.story({
  parameters: { pseudo: { hover: true } },
  render: () => <Button>Label</Button>,
});
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

export const Hover = {
  parameters: { pseudo: { hover: true } },
  render: () => <Button>Label</Button>,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => <Button>Label</Button>,
};
```

```tsx filename="Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => <Button>Label</Button>,
};
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  component: Button,
};

export const Hover = {
  parameters: { pseudo: { hover: true } },
  render: () => ({
    components: { Button },
    template: '<Button label="Label" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => ({
    components: { Button },
    template: '<Button label="Label" />',
  }),
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => ({
    components: { Button },
    template: '<Button label="Label" />',
  }),
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'custom-button',
};

export const Hover = {
  parameters: { pseudo: { hover: true } },
  render: () => html`<custom-button label="Label"></custom-button>`,
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

const meta: Meta = {
  component: 'custom-button',
};

export default meta;
type Story = StoryObj;

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: () => html`<custom-button label="Label"></custom-button>`,
};
```

```js filename="Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

export default {
  component: Button,
};

export const Basic = {
  parameters: { pseudo: { hover: true } },
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  parameters: { pseudo: { hover: true } },
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  parameters: { pseudo: { hover: true } },
};
```
