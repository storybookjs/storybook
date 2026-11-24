```jsx filename="my-component/component.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import { useArgs } from 'storybook/preview-api';

import preview from '../.storybook/preview';

import { Checkbox } from './checkbox';

const meta = preview.meta({
  title: 'Inputs/Checkbox',
  component: Checkbox,
});

export const Example = meta.story({
  args: {
    isChecked: false,
    label: 'Try Me!',
  },
  /**
   * 👇 To avoid linting issues, it is recommended to use a function with a capitalized name.
   * If you are not concerned with linting, you may use an arrow function.
   */
  render: function Render(args) {
    const [{ isChecked }, updateArgs] = useArgs();

    function onChange() {
      updateArgs({ isChecked: !isChecked });
    }

    return <Checkbox {...args} onChange={onChange} isChecked={isChecked} />;
  },
});
```

```tsx filename="my-component/component.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import { useArgs } from 'storybook/preview-api';

import preview from '../.storybook/preview';

import { Checkbox } from './checkbox';

const meta = preview.meta({
  title: 'Inputs/Checkbox',
  component: Checkbox,
});

export const Example = meta.story({
  args: {
    isChecked: false,
    label: 'Try Me!',
  },
  /**
   * 👇 To avoid linting issues, it is recommended to use a function with a capitalized name.
   * If you are not concerned with linting, you may use an arrow function.
   */
  render: function Render(args) {
    const [{ isChecked }, updateArgs] = useArgs();

    function onChange() {
      updateArgs({ isChecked: !isChecked });
    }

    return <Checkbox {...args} onChange={onChange} isChecked={isChecked} />;
  },
});
```

```tsx filename="my-component/component.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';
import { useArgs } from 'storybook/preview-api';

import { Checkbox } from './checkbox';

const meta = {
  title: 'Inputs/Checkbox',
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Example = {
  args: {
    isChecked: false,
    label: 'Try Me!',
  },
  /**
   * 👇 To avoid linting issues, it is recommended to use a function with a capitalized name.
   * If you are not concerned with linting, you may use an arrow function.
   */
  render: function Render(args) {
    const [{ isChecked }, updateArgs] = useArgs();

    function onChange() {
      updateArgs({ isChecked: !isChecked });
    }

    return <Checkbox {...args} onChange={onChange} isChecked={isChecked} />;
  },
} satisfies Story;
```

```jsx filename="my-component/component.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { useArgs } from 'storybook/preview-api';

import { Checkbox } from './checkbox';

export default {
  title: 'Inputs/Checkbox',
  component: Checkbox,
};

export const Example = {
  args: {
    isChecked: false,
    label: 'Try Me!',
  },
  /**
   * 👇 To avoid linting issues, it is recommended to use a function with a capitalized name.
   * If you are not concerned with linting, you may use an arrow function.
   */
  render: function Render(args) {
    const [{ isChecked }, updateArgs] = useArgs();

    function onChange() {
      updateArgs({ isChecked: !isChecked });
    }

    return <Checkbox {...args} onChange={onChange} isChecked={isChecked} />;
  },
};
```

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Checkbox from './Checkbox.svelte';

  const { Story } = preview.meta({
    title: 'Inputs/Checkbox',
    component: Checkbox,
  });

  // 👇 Storybook updates the args of the story when this state changes
  let isChecked = $state(false);

  function onChange() {
    isChecked = !isChecked;
  }
</script>

<Story name="Example" args={{ isChecked, label: 'Try Me!', onChange }} />
```

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Checkbox from './Checkbox.svelte';

  const { Story } = defineMeta({
    title: 'Inputs/Checkbox',
    component: Checkbox,
  });

  // 👇 Storybook updates the args of the story when this state changes
  let isChecked = $state(false);

  function onChange() {
    isChecked = !isChecked;
  }
</script>

<Story name="Example" args={{ isChecked, label: 'Try Me!', onChange }} />
```

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Checkbox from './Checkbox.svelte';

  const { Story } = preview.meta({
    title: 'Inputs/Checkbox',
    component: Checkbox,
  });

  // 👇 Storybook updates the args of the story when this state changes
  let isChecked = $state(false);

  function onChange() {
    isChecked = !isChecked;
  }
</script>

<Story name="Example" args={{ isChecked, label: 'Try Me!', onChange }} />
```

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module lang="ts">
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Checkbox from './Checkbox.svelte';

  const { Story } = defineMeta({
    title: 'Inputs/Checkbox',
    component: Checkbox,
  });

  // 👇 Storybook updates the args of the story when this state changes
  let isChecked = $state(false);

  function onChange() {
    isChecked = !isChecked;
  }
</script>

<Story name="Example" args={{ isChecked, label: 'Try Me!', onChange }} />
```
