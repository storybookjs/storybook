```ts filename="Example.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Example } from './Example';

const meta: Meta<Example> = {
  component: Example,
  argTypes: {
    label: {
      control: { type: 'select' },
      options: ['Normal', 'Bold', 'Italic'],
      mapping: {
        Bold: <b>Bold</b>,
        Italic: <i>Italic</i>,
      },
    },
  },
};

export default meta;
```

```svelte filename="Example.stories.svelte" renderer="svelte" language="js"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Example from './Example.svelte';

  const { Story } = defineMeta({
    component: Example,
    argTypes: {
      label: {
        control: { type: 'select' },
        options: ['Normal', 'Bold', 'Italic'],
        mapping: {
          Normal: normal,
          Bold: bold,
          Italic: italic,
        },
      },
    },
  });
</script>

{#snippet normal()}
  <span>Normal</span>
{/snippet}

{#snippet bold()}
  <b>Bold</b>
{/snippet}
{#snippet italic()}
  <i>Italic</i>
{/snippet}
```

```svelte filename="Example.stories.svelte" renderer="svelte" language="ts"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Example from './Example.svelte';

  const { Story } = defineMeta({
    component: Example,
    argTypes: {
      label: {
        control: { type: 'select' },
        options: ['Normal', 'Bold', 'Italic'],
        mapping: {
          Normal: normal,
          Bold: bold,
          Italic: italic,
        },
      },
    },
  });
</script>

{#snippet normal()}
  <span>Normal</span>
{/snippet}

{#snippet bold()}
  <b>Bold</b>
{/snippet}
{#snippet italic()}
  <i>Italic</i>
{/snippet}
```

```js filename="Example.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Example } from './Example';

export default {
  component: Example,
  argTypes: {
    label: {
      control: { type: 'select' },
      options: ['Normal', 'Bold', 'Italic'],
      mapping: {
        Bold: <b>Bold</b>,
        Italic: <i>Italic</i>,
      },
    },
  },
};
```

```ts filename="Example.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { Example } from './Example';

const meta = {
  component: Example,
  argTypes: {
    label: {
      control: { type: 'select' },
      options: ['Normal', 'Bold', 'Italic'],
      mapping: {
        Bold: <b>Bold</b>,
        Italic: <i>Italic</i>,
      },
    },
  },
} satisfies Meta<typeof Example>;

export default meta;
```

```js filename="Example.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'demo-example',
  argTypes: {
    label: {
      control: { type: 'select' },
      options: ['Normal', 'Bold', 'Italic'],
      mapping: {
        Bold: html`<b>Bold</b>`,
        Italic: html`<i>Italic</i>`,
      },
    },
  },
};
```

```ts filename="Example.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

import { html } from 'lit';

const meta: Meta = {
  component: 'demo-example',
  argTypes: {
    label: {
      control: { type: 'select' },
      options: ['Normal', 'Bold', 'Italic'],
      mapping: {
        Bold: html`<b>Bold</b>`,
        Italic: html`<i>Italic</i>`,
      },
    },
  },
};

export default meta;
```

```ts filename="Example.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Example } from './Example';

const meta = preview.meta({
  component: Example,
  argTypes: {
    label: {
      control: { type: 'select' },
      options: ['Normal', 'Bold', 'Italic'],
      mapping: {
        Bold: <b>Bold</b>,
        Italic: <i>Italic</i>,
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Example.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { Example } from './Example';

const meta = preview.meta({
  component: Example,
  argTypes: {
    label: {
      control: { type: 'select' },
      options: ['Normal', 'Bold', 'Italic'],
      mapping: {
        Bold: <b>Bold</b>,
        Italic: <i>Italic</i>,
      },
    },
  },
});
```
