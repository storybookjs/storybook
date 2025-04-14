```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="csf3-story-ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/api/csf
 * to learn more about it.
 */
const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="csf3-story-ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/api/csf
 * to learn more about it.
 */
const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="csf3-story-ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/api/csf
 * to learn more about it.
 */
const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: { message: 'Hello world!' },
};
```

```js filename="src/components/MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="csf3-story"
import { MyComponent } from './MyComponent';

/**
 * Story written in CSF 3.0 with auto title generation
 * See https://storybook.js.org/docs/api/csf
 * to learn more about it.
 */
export default { component: MyComponent };

export const Default = {
  args: { message: 'Hello world!' },
};
```
