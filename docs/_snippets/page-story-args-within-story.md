```jsx filename="my-component/component.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
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

```tsx filename="my-component/component.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';
import { useArgs } from 'storybook/preview-api';

import { Checkbox } from './checkbox';

const meta = {
  title: 'Inputs/Checkbox',
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;
export default meta;

type Story = StoryObj<typeof Checkbox>;

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

```tsx filename="my-component/component.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { useArgs } from 'storybook/preview-api';

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

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="my-component/component.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { useArgs } from 'storybook/preview-api';

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
