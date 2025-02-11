```ts filename="FooBar.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Foo } from './Foo.component';

const meta: Meta<Foo> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'OtherFoo/Bar',
  component: Foo,
  id: 'Foo/Bar', // Or 'foo-bar' if you prefer
};

export default meta;
type Story = StoryObj<Foo>;

export const Baz: Story = {
  name: 'Insert name here',
};
```

```js filename="FooBar.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Foo } from './Foo';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'OtherFoo/Bar',
  component: Foo,
  id: 'Foo/Bar', // Or 'foo-bar' if you prefer
};

export const Baz = {
  name: 'Insert name here',
};
```

```js filename="FooBar.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Foo } from './Foo';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'OtherFoo/Bar',
  component: Foo,
  id: 'Foo/Bar', // Or 'foo-bar' if you prefer
});

export const Baz = meta.story({
  name: 'Insert name here',
});
```

```ts filename="FooBar.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Foo } from './Foo';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'OtherFoo/Bar',
  component: Foo,
  id: 'Foo/Bar', // Or 'foo-bar' if you prefer
} satisfies Meta<typeof Foo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Baz: Story = {
  name: 'Insert name here',
};
```

```ts filename="FooBar.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Foo } from './Foo';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'OtherFoo/Bar',
  component: Foo,
  id: 'Foo/Bar', // Or 'foo-bar' if you prefer
});

export const Baz = meta.story({
  name: 'Insert name here',
});
```

```ts filename="FooBar.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Foo } from './Foo';

const meta: Meta<typeof Foo> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'OtherFoo/Bar',
  component: Foo,
  id: 'Foo/Bar', // Or 'foo-bar' if you prefer
};

export default meta;
type Story = StoryObj<typeof Foo>;

export const Baz: Story = {
  name: 'Insert name here',
};
```

```ts filename="FooBar.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Foo } from './Foo';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'OtherFoo/Bar',
  component: Foo,
  id: 'Foo/Bar', // Or 'foo-bar' if you prefer
});

export const Baz = meta.story({
  name: 'Insert name here',
});
```

```js filename="FooBar.stories.js" renderer="web-components" language="js"
export default {
  title: 'OtherFoo/Bar',
  component: 'foo',
  id: 'Foo/Bar', // Or 'foo-bar' if you prefer
};

export const Baz = {
  name: 'Insert name here',
};
```

```ts filename="FooBar.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  title: 'OtherFoo/Bar',
  component: 'foo',
  id: 'Foo/Bar', // Or 'foo-bar' if you prefer
};

export default meta;
type Story = StoryObj;

export const Baz: Story = {
  name: 'Insert name here',
};
```
