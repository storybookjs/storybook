```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  argTypes: {
    // 👇 All Button stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
};

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
  argTypes: {
    // 👇 All Button stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  argTypes: {
    // 👇 All Button stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
});
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta } from '@storybook/your-renderer';

import { Button } from './Button';

const meta = {
  component: Button,
  argTypes: {
    // 👇 All Button stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  argTypes: {
    // 👇 All Button stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
});
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta } from '@storybook/your-renderer';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  argTypes: {
    // 👇 All Button stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
};

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  argTypes: {
    // 👇 All Button stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
});
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  argTypes: {
    // 👇 All Button stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
  argTypes: {
    // 👇 All Button stories expect a label arg
    label: {
      control: 'text',
      description: 'Overwritten description',
    },
  },
};

export default meta;
```
