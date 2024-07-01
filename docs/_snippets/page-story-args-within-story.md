```js filename="my-component/component.stories.js|jsx" renderer="react" language="js"
import { useArgs } from '@storybook/preview-api';
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

```ts filename="my-component/component.stories.ts|tsx" renderer="react" language="ts-4-9"
import { StoryObj, Meta } from '@storybook/react';
import { useArgs } from '@storybook/preview-api';
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

```ts filename="my-component/component.stories.ts|tsx" renderer="react" language="ts"
import { StoryObj, Meta } from '@storybook/react';
import { useArgs } from '@storybook/preview-api';
import { Checkbox } from './checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Inputs/Checkbox',
  component: Checkbox,
};
export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Example: Story = {
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

