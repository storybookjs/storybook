```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './Button';

const meta: Meta<Button> = {
  component: Button,
  /**
   * 👇 All stories in this file will have these tags applied:
   *    - autodocs
   *    - dev (implicit default, inherited from preview)
   *    - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<Button>;

export const ExperimentalFeatureStory: Story = {
  /**
   * 👇 This particular story will have these tags applied:
   *    - experimental
   *    - autodocs (inherited from meta)
   *    - dev (inherited from meta)
   *    - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  /**
   * 👇 All stories in this file will have these tags applied:
   *    - autodocs
   *    - dev (implicit default, inherited from preview)
   *    - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};

export const ExperimentalFeatureStory = {
  /**
   * 👇 This particular story will have these tags applied:
   *    - experimental
   *    - autodocs (inherited from meta)
   *    - dev (inherited from meta)
   *    - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts-4-9"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  /**
   * 👇 All stories in this file will have these tags applied:
   *    - autodocs
   *    - dev (implicit default, inherited from preview)
   *    - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const ExperimentalFeatureStory: Story = {
  /**
   * 👇 This particular story will have these tags applied:
   *    - experimental
   *    - autodocs (inherited from meta)
   *    - dev (inherited from meta)
   *    - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  /**
   * 👇 All stories in this file will have these tags applied:
   *    - autodocs
   *    - dev (implicit default, inherited from preview)
   *    - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Button>;

export const ExperimentalFeatureStory: Story = {
  /**
   * 👇 This particular story will have these tags applied:
   *    - experimental
   *    - autodocs (inherited from meta)
   *    - dev (inherited from meta)
   *    - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  title: 'Button',
  component: 'demo-button',
  /**
   * 👇 All stories in this file will have these tags applied:
   *    - autodocs
   *    - dev (implicit default, inherited from preview)
   *    - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};

export const ExperimentalFeatureStory = {
  /**
   * 👇 This particular story will have these tags applied:
   *    - experimental
   *    - autodocs (inherited from meta)
   *    - dev (inherited from meta)
   *    - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
  /**
   * 👇 All stories in this file will have these tags applied:
   *    - autodocs
   *    - dev (implicit default, inherited from preview)
   *    - test (implicit default, inherited from preview)
   */
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj;

export const ExperimentalFeatureStory: Story = {
  /**
   * 👇 This particular story will have these tags applied:
   *    - experimental
   *    - autodocs (inherited from meta)
   *    - dev (inherited from meta)
   *    - test (inherited from meta)
   */
  tags: ['experimental'],
};
```

