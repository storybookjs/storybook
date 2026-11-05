```ts filename="Button.stories.ts" renderer="angular" language="ts"
import { argsToTemplate, moduleMetadata } from '@storybook/angular';

import preview from '../.storybook/preview';

import { Button } from './button.component';
import { Icon } from './icon.component';

type CustomArgs = { icon: 'check' | 'heart' | 'star' };

const meta = preview.type<{ args: CustomArgs }>().meta({
  component: Button,
  decorators: [
    moduleMetadata({
      declarations: [Icon],
    }),
  ],
  // 👇 Correct types
  render: ({ children, icon, ...args }) => ({
    props: { ...args, children, icon },
    template: `
      <demo-button ${argsToTemplate(args)}>
        <demo-icon [name]="icon"></demo-icon> {{ children }}
      </demo-button>
    `,
  }),
});

export const Primary = meta.story({
  // 👇 Correct types
  args: {
    children: 'Button',
    icon: 'star',
  },
});
```

```tsx filename="Button.stories.ts|tsx" renderer="react" language="ts"
import preview from '../.storybook/preview';

import { Button } from './Button';
import { Icon } from './Icon';

type CustomArgs = { icon: 'check' | 'heart' | 'star' };

const meta = preview.type<{ args: CustomArgs }>().meta({
  component: Button,
  // 👇 Correct types
  render: ({ children, icon, ...args }) => (
    <Button {...args}>
      <Icon name={icon} /> {children}
    </Button>
  ),
});

export const Primary = meta.story({
  // 👇 Correct types
  args: {
    children: 'Button',
    icon: 'star',
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  type CustomArgs = { icon: 'check' | 'heart' | 'star' };

  const { Story } = preview.type<{ args: CustomArgs }>().meta({
    component: Button,
  });
</script>

<!-- 👇 Correct types -->
<Story name="Primary" args={{ label: 'Button', icon: 'star' }}>
  {#snippet template({ icon, ...args })}
    <Button {...args}>
      <Icon name={icon} />
    </Button>
  {/snippet}
</Story>
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import preview from '../.storybook/preview';

import Button from './Button.vue';
import Icon from './Icon.vue';

type CustomArgs = { icon: 'check' | 'heart' | 'star' };

const meta = preview.type<{ args: CustomArgs }>().meta({
  component: Button,
  // 👇 Correct types
  render: ({ children, icon, ...args }) => ({
    components: { Button, Icon },
    setup() {
      return { args, children, icon };
    },
    template: '<Button v-bind="args"><Icon :name="icon" /> {{ children }}</Button>',
  }),
});

export const Primary = meta.story({
  // 👇 Correct types
  args: {
    children: 'Button',
    icon: 'star',
  },
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import { html } from 'lit';

import preview from '../.storybook/preview';

type CustomArgs = { icon: 'check' | 'heart' | 'star' };

const meta = preview.type<{ args: CustomArgs }>().meta({
  component: 'demo-button',
  // 👇 Correct types
  render: ({ children, icon, primary }) => html`
    <demo-button ?primary=${primary}>
      <demo-icon name=${icon}></demo-icon> ${children}
    </demo-button>
  `,
});

export const Primary = meta.story({
  // 👇 Correct types
  args: {
    children: 'Button',
    icon: 'star',
  },
});
```
