```ts filename="Histogram.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { HistogramComponent } from './histogram.component';

const meta: Meta<HistogramComponent> = {
  component: HistogramComponent,
};

export default meta;
type Story = StoryObj<HistogramComponent>;

export const Default: Story = {
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```js filename="Histogram.stories.js" renderer="html" language="js"
import { createHistogram } from './Histogram';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Histogram',
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Default = {
  render: (args) => createHistogram(args),
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```ts filename="Histogram.stories.ts" renderer="html" language="ts"
import type { Meta, StoryObj } from '@storybook/html';

import { createHistogram, HistogramProps } from './Histogram';

const meta: Meta<HistogramProps> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Histogram',
};

export default meta;
type Story = StoryObj<HistogramProps>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Default: Story = {
  render: (args) => createHistogram(args),
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```js filename="Histogram.stories.js|jsx" renderer="preact" language="js"
/** @jsx h */
import { h } from 'preact';

import { Histogram } from './Histogram';

export default {
  component: Histogram,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Default = {
  render: (args) => <Histogram {...args} />,
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```js filename="Histogram.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Histogram } from './Histogram';

export default {
  component: Histogram,
};

export const Default = {
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```ts filename="Histogram.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Histogram } from './Histogram';

const meta = {
  component: Histogram,
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```js filename="Histogram.stories.js|jsx" renderer="solid" language="js"
import { Histogram } from './Histogram';

export default {
  component: Histogram,
};

export const Default = {
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```ts filename="Histogram.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { Histogram } from './Histogram';

const meta = {
  component: Histogram,
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```svelte filename="Histogram.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Histogram from './Histogram.svelte';

  const { Story } = defineMeta({
    component: Histogram,
  });
</script>

<Story
  name="Default"
  args={{
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  }}
/>
```

```js filename="Histogram.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Histogram from './Histogram.svelte';

export default {
  component: Histogram,
};

export const Default = {
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```svelte filename="Histogram.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Histogram from './Histogram.svelte';

  const { Story } = defineMeta({
    component: Histogram,
  });
</script>

<Story
  name="Default"
  args={{
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  }}
/>
```

```ts filename="Histogram.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import Histogram from './Histogram.svelte';

const meta = {
  component: Histogram,
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```js filename="Histogram.stories.js" renderer="vue" language="js"
import Histogram from './Histogram.vue';

export default {
  component: Histogram,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Default = {
  render: (args) => ({
    components: { Histogram },
    setup() {
      return { args };
    },
    template: '<Histogram v-bind="args" />',
  }),
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```ts filename="Histogram.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import Histogram from './Histogram.vue';

const meta = {
  component: Histogram,
} satisfies Meta<typeof Histogram>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Default: Story = {
  render: (args) => ({
    components: { Histogram },
    setup() {
      return { args };
    },
    template: '<Histogram v-bind="args" />',
  }),
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```js filename="Histogram.stories.js" renderer="web-components" language="js"
export default {
  component: 'histogram-component',
};

export const Default = {
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```ts filename="Histogram.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'histogram-component',
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
};
```

```ts filename="Histogram.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Histogram } from './Histogram';

const meta = preview.meta({
  component: Histogram,
});

export const Default = meta.story({
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Histogram.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { Histogram } from './Histogram';

const meta = preview.meta({
  component: Histogram,
});

export const Default = meta.story({
  args: {
    dataType: 'latency',
    showHistogramLabels: true,
    histogramAccentColor: '#1EA7FD',
    label: 'Latency distribution',
  },
});
```
