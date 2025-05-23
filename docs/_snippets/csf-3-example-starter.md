```ts filename="CSF 3 - Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = { component: Button };

export default meta;
type Story = StoryObj<Button>;

export const Primary: Story = { args: { primary: true } };
```

```js filename="CSF 3 - Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default { component: Button };

export const Primary = { args: { primary: true } };
```

```ts filename="CSF 3 - Button.stories.ts|tsx" renderer="react" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { primary: true } };
```

```ts filename="CSF 3 - Button.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { primary: true } };
```

```js filename="CSF 3 - Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default { component: Button };

export const Primary = { args: { primary: true } };
```

```js filename="CSF 3 - Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

export default { component: Button };

export const Primary = { args: { primary: true } };
```

```ts filename="CSF 3 - Button.stories.ts" renderer="svelte" language="ts"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { primary: true } };
```

```js filename="CSF 3 - Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default { component: Button };

export const Primary = { args: { primary: true } };
```

```ts filename="CSF 3 - Button.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import Button from './Button.vue';

const meta = { component: Button } satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { primary: true } };
```

```js filename="CSF 3 - Button.stories.js" renderer="web-components" language="js"
export default {
  title: 'components/Button',
  component: 'demo-button',
};

export const Primary = { args: { primary: true } };
```

```ts filename="CSF 3 - Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  title: 'components/Button',
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

export const Primary: Story = { args: { primary: true } };
```
