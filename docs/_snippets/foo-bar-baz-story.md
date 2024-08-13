```ts filename="FooBar.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Foo } from './Foo.component';

const meta: Meta<Foo> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Foo/Bar',
  component: Foo,
};

export default meta;
type Story = StoryObj<Foo>;

export const Baz: Story = {};
```

```js filename="FooBar.stories.js|jsx" renderer="common" language="js"
import { Foo } from './Foo';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Foo/Bar',
  component: Foo,
};

export const Baz = {};
```

```ts filename="FooBar.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Foo } from './Foo';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Foo/Bar',
  component: Foo,
};

export default meta;
type Story = StoryObj<typeof Foo>;

export const Baz: Story = {};
```

```ts filename="FooBar.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Foo } from './Foo';

const meta: Meta<typeof Foo> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Foo/Bar',
  component: Foo,
};

export default meta;
type Story = StoryObj<typeof Foo>;

export const Baz: Story = {};
```
