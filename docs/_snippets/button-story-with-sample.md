```jsx filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

export const Sample = {
  render: () => <Button label="hello button" />,
};
```

```jsx filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Sample = meta.story({
  render: () => <Button label="hello button" />,
});
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sample: Story = {
  render: () => <Button label="hello button" />,
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Sample = meta.story({
  render: () => <Button label="hello button" />,
});
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Sample: Story = {
  render: () => <Button label="hello button" />,
};
```

```js filename="Button.stories.js|jsx" renderer="solid" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

export const Sample = {
  render: () => <Button label="hello button" />,
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Sample = meta.story({
  render: () => <Button label="hello button" />,
});
```
