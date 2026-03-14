```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

/**
 * Primary buttons are used for the main action in a view.
 * There should not be more than one primary button per view.
 *
 * @summary for the main action in a view
 */
export const Primary = {
  args: { primary: true },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Primary buttons are used for the main action in a view.
 * There should not be more than one primary button per view.
 *
 * @summary for the main action in a view
 */
export const Primary: Story = {
  args: { primary: true },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

/**
 * Primary buttons are used for the main action in a view.
 * There should not be more than one primary button per view.
 *
 * @summary for the main action in a view
 */
export const Primary = meta.story({
  args: { primary: true },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

/**
 * Primary buttons are used for the main action in a view.
 * There should not be more than one primary button per view.
 *
 * @summary for the main action in a view
 */
export const Primary = meta.story({
  args: { primary: true },
});
```
