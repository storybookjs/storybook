```ts filename="CheckBox.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Checkbox } from './checkbox.component';

const meta: Meta<Checkbox> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Checkbox',
  component: CheckBox,
};

export default meta;
```

```js filename="Checkbox.stories.js|jsx" renderer="common" language="js"
import { CheckBox } from './Checkbox';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Checkbox',
  component: CheckBox,
};
```

```ts filename="CheckBox.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { CheckBox } from './Checkbox';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Checkbox',
  component: CheckBox,
} satisfies Meta<typeof CheckBox>;

export default meta;
```

```ts filename="CheckBox.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { CheckBox } from './Checkbox';

const meta: Meta<typeof CheckBox> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Design System/Atoms/Checkbox',
  component: CheckBox,
};

export default meta;
```

```js filename="Checkbox.stories.js" renderer="web-components" language="js"
export default {
  title: 'Design System/Atoms/Checkbox',
  component: 'demo-checkbox',
};
```

```ts filename="CheckBox.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

const meta: Meta = {
  title: 'Design System/Atoms/Checkbox',
  component: 'demo-checkbox',
};

export default meta;
```

