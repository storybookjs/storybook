```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

// Function to emulate pausing between interactions
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const ExampleChangeEvent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { userEvent, within } from '@storybook/test';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvasElement to query the DOM
-->
<Story
  name="ExampleChangeEvent"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  }}
/>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { userEvent, within } from '@storybook/test';

import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

// Function to emulate pausing between interactions
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const ExampleChangeEvent = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

// Function to emulate pausing between interactions
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const ExampleChangeEvent = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { userEvent, within } from '@storybook/test';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
</script>

<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvasElement to query the DOM
-->
<Story
  name="ExampleChangeEvent"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  }}
/>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import { userEvent, within } from '@storybook/test';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// Function to emulate pausing between interactions
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const ExampleChangeEvent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// Function to emulate pausing between interactions
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const ExampleChangeEvent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import { userEvent, within } from '@storybook/test';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
</script>


<!--
  See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
  to learn more about using the canvasElement to query the DOM
-->
<Story
  name="ExampleChangeEvent"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  }}
/>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import { userEvent, within } from '@storybook/test';

import MyComponent from './MyComponent.svelte';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

// Function to emulate pausing between interactions
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const ExampleChangeEvent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

// Function to emulate pausing between interactions
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const ExampleChangeEvent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { userEvent, within } from '@storybook/test';

export default {
  component: 'demo-my-component',
};

// Function to emulate pausing between interactions
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const ExampleChangeEvent = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';
import { userEvent, within } from '@storybook/test';

const meta: Meta = {
  component: 'demo-my-component',
};

export default meta;
type Story = StoryObj;

// Function to emulate pausing between interactions
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const ExampleChangeEvent: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const select = canvas.getByRole('listbox');

    await userEvent.selectOptions(select, ['One Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Another Item']);
    await sleep(2000);

    await userEvent.selectOptions(select, ['Yet another item']);
  },
};
```
