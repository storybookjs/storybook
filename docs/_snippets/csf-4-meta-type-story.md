```ts filename="Button.stories.ts" renderer="angular" language="ts"
import { argsToTemplate, moduleMetadata } from '@storybook/angular';

import preview from '../.storybook/preview';

import { Button } from './button.component';
import { Icon } from './icon.component';

type CustomArgs = { icon: 'check' | 'heart' | 'star' };

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  args: { children: 'Button' },
});

export const WithIcon = meta.type<{ args: CustomArgs }>().story({
  // 👇 `icon` is typed, and required, in this story only
  args: { children: 'Button', icon: 'star' },
  decorators: [
    moduleMetadata({
      declarations: [Icon],
    }),
  ],
  render: ({ children, icon, ...args }) => ({
    props: { ...args, children, icon },
    template: `
      <demo-button ${argsToTemplate(args)}>
        <demo-icon [name]="icon"></demo-icon> {{ children }}
      </demo-button>
    `,
  }),
});
```

```tsx filename="Button.stories.ts|tsx" renderer="react" language="ts"
import preview from '../.storybook/preview';

import { Button } from './Button';
import { Icon } from './Icon';

type CustomArgs = { icon: 'check' | 'heart' | 'star' };

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  args: { children: 'Button' },
});

export const WithIcon = meta.type<{ args: CustomArgs }>().story({
  // 👇 `icon` is typed, and required, in this story only
  args: { children: 'Button', icon: 'star' },
  render: ({ children, icon, ...args }) => (
    <Button {...args}>
      <Icon name={icon} /> {children}
    </Button>
  ),
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  const meta = preview.meta({ component: Button });
  const { Story } = meta;
  const { Story: IconStory } = meta.type<{ args: { icon: string } }>();
</script>

<Story name="Primary" args={{ children: 'Button' }} />

<!-- 👇 `icon` is typed, and required, in the stories of IconStory only -->
<IconStory name="With icon" args={{ children: 'Button', icon: 'star' }} >
  {#snippet template({ icon, ...args })}
    <Button {...args}>
      <Icon name={icon} /> {children}
    </Button>
  {/snippet}
</IconStory>
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import preview from '../.storybook/preview';

import Button from './Button.vue';
import Icon from './Icon.vue';

type CustomArgs = { icon: 'check' | 'heart' | 'star' };

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  args: { children: 'Button' },
});

export const WithIcon = meta.type<{ args: CustomArgs }>().story({
  // 👇 `icon` is typed, and required, in this story only
  args: { children: 'Button', icon: 'star' },
  render: ({ children, icon, ...args }) => ({
    components: { Button, Icon },
    setup() {
      return { args, children, icon };
    },
    template: '<Button v-bind="args"><Icon :name="icon" /> {{ children }}</Button>',
  }),
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import { html } from 'lit';

import preview from '../.storybook/preview';

type CustomArgs = { icon: 'check' | 'heart' | 'star' };

const meta = preview.meta({
  component: 'demo-button',
});

export const Primary = meta.story({
  args: { children: 'Button' },
});

export const WithIcon = meta.type<{ args: CustomArgs }>().story({
  // 👇 `icon` is typed, and required, in this story only
  args: { children: 'Button', icon: 'star' },
  render: ({ children, icon, primary }) => html`
    <demo-button ?primary=${primary}>
      <demo-icon name=${icon}></demo-icon> ${children}
    </demo-button>
  `,
});
```
