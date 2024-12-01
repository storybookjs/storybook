```ts filename="CSF 2 - Button.stories.ts" renderer="angular" language="ts"
import { Meta, Story } from '@storybook/angular';

import { Button } from './button.component';

export default {
  title: 'Button',
  component: Button,
} as Meta;

export const Primary: Story = (args) => ({
  props: args,
});
Primary.args = { primary: true };
```

```js filename="CSF 2 - Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default {
  title: 'Button',
  component: Button,
};

export const Primary = (args) => <Button {...args} />;
Primary.args = { primary: true };
```

```tsx filename="CSF 2 - Button.stories.ts|tsx" renderer="react" language="ts"
import { ComponentStory, ComponentMeta } from '@storybook/react';

import { Button } from './Button';

export default {
  title: 'Button',
  component: Button,
} as ComponentMeta<typeof Button>;

export const Primary: ComponentStory<typeof Button> = (args) => <Button {...args} />;
Primary.args = { primary: true };
```

```js filename="CSF 2 - Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  title: 'Button',
  component: Button,
};

export const Primary = (args) => <Button {...args} />;
Primary.args = { primary: true };
```

```tsx filename="CSF 2 - Button.stories.ts|tsx" renderer="solid" language="ts"
import { ComponentStory, ComponentMeta } from 'storybook-solidjs';

import { Button } from './Button';

export default {
  title: 'Button',
  component: Button,
} as ComponentMeta<typeof Button>;

export const Primary: ComponentStory<typeof Button> = (args) => <Button {...args} />;
Primary.args = { primary: true };
```

```js filename="CSF 2 - Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

export default {
  title: 'Button',
  component: Button,
};

export const Primary = (args) => ({
  Component: Button,
  props: args,
});
Primary.args = { primary: true };
```

```ts filename="CSF 2 - Button.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryFn } from '@storybook/svelte';

import Button from './Button.svelte';

export default {
  title: 'Button',
  component: Button,
} as Meta<typeof Button>;

export const Primary: StoryFn<typeof Button> = (args) => ({
  Component: Button,
  props: args,
});
Primary.args = { primary: true };
```

```js filename="CSF 2 - Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  title: 'Button',
  component: Button,
};

export const Primary = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});
Primary.args = { primary: true };
```

```ts filename="CSF 2 - Button.stories.ts" renderer="vue" language="ts"
import { Meta, StoryFn } from '@storybook/vue3';

import Button from './Button.vue';

export default {
  title: 'Button',
  component: Button,
} as Meta<typeof Button>;

export const Primary: StoryFn<typeof Button> = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});
Primary.args = { primary: true };
```

```js filename="CSF 2 - Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  title: 'components/Button',
  component: 'demo-button',
};

export const Primary = ({ primary }) => html`<custom-button ?primary=${primary}></custom-button>`;
Primary.args = {
  primary: true,
};
```

```ts filename="CSF 2 - Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, Story } from '@storybook/web-components';

import { html } from 'lit';

export default {
  title: 'components/Button',
  component: 'demo-button',
} as Meta;

export const Primary: Story = ({ primary }) =>
  html`<demo-button ?primary=${primary}></demo-button>`;
Primary.args = {
  primary: true,
};
```
