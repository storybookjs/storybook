```ts filename="ButtonGroup.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { ButtonGroup } from './ButtonGroup.component';
import { Button } from './button.component';

//👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

const meta: Meta<ButtonGroup> = {
  component: ButtonGroup,
  decorators: [
    moduleMetadata({
      declarations: [Button],
      imports: [CommonModule],
    }),
  ],
};

export default meta;
type Story = StoryObj<ButtonGroup>;

export const Pair: Story = {
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```js filename="ButtonGroup.stories.js|jsx" renderer="react" language="js"
import { ButtonGroup } from '../ButtonGroup';

//👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

export default {
  component: ButtonGroup,
};

export const Pair = {
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```ts filename="ButtonGroup.stories.ts|tsx" renderer="react" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { ButtonGroup } from '../ButtonGroup';

//👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

const meta = {
  component: ButtonGroup,
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pair: Story = {
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```js filename="ButtonGroup.stories.js|jsx" renderer="solid" language="js"
import { ButtonGroup } from '../ButtonGroup';

//👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

export default {
  component: ButtonGroup,
};

export const Pair = {
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```tsx filename="ButtonGroup.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { ButtonGroup } from '../ButtonGroup';

//👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

const meta = {
  component: ButtonGroup,
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pair: Story = {
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```svelte filename="ButtonGroup.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import ButtonGroup from './ButtonGroup.svelte';

  //👇 Imports the Button stories
  import * as ButtonStories from './Button.stories.svelte';

  const { Story } = defineMeta({
    component: ButtonGroup,
  });
</script>

<Story
  name="Pair"
  args={{
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  }}
/>
```

```js filename="ButtonGroup.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import ButtonGroup from '../ButtonGroup.svelte';

//👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

export default {
  component: ButtonGroup,
};

export const Pair = {
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```svelte filename="ButtonGroup.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import ButtonGroup from './ButtonGroup.svelte';

  //👇 Imports the Button stories
  import * as ButtonStories from './Button.stories.svelte';

  const { Story } = defineMeta({
    component: ButtonGroup,
  });
</script>

<Story
  name="Pair"
  args={{
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  }}
/>
```

```ts filename="ButtonGroup.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import ButtonGroup from './ButtonGroup.svelte';

//👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

const meta = {
  component: ButtonGroup,
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pair: Story = {
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```js filename="ButtonGroup.stories.js" renderer="vue" language="js"
import ButtonGroup from './ButtonGroup.vue';

//👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

export default {
  component: ButtonGroup,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Pair = {
  render: (args) => ({
    components: { ButtonGroup },
    setup() {
      return { args };
    },
    template: '<ButtonGroup v-bind="args" />',
  }),
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```ts filename="ButtonGroup.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import ButtonGroup from './ButtonGroup.vue';

//👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

const meta = {
  component: ButtonGroup,
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pair: Story = {
  render: (args) => ({
    components: { ButtonGroup },
    setup() {
      return { args };
    },
    template: '<ButtonGroup v-bind="args" />',
  }),
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```js filename="ButtonGroup.stories.js" renderer="web-components" language="js"
// 👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

export default {
  component: 'demo-button-group',
};

export const Pair = {
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```

```ts filename="ButtonGroup.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

// 👇 Imports the Button stories
import * as ButtonStories from './Button.stories';

const meta: Meta = {
  component: 'demo-button-group',
};

export default meta;
type Story = StoryObj;

export const Pair: Story = {
  args: {
    buttons: [{ ...ButtonStories.Primary.args }, { ...ButtonStories.Secondary.args }],
    orientation: 'horizontal',
  },
};
```
