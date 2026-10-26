```svelte filename="Example.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Example from './Example.svelte';

  const { Story } = preview.meta({
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

```svelte filename="Example.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

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

```svelte filename="Example.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Example from './Example.svelte';

  const { Story } = preview.meta({
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

```svelte filename="Example.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

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

```js filename="Example.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
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
});
```

```ts filename="Example.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
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
});
```

```js filename="Example.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
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

```ts filename="Example.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
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

```js filename="Example.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```ts filename="Example.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```js filename="Example.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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
