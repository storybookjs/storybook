```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { withActions } from '@storybook/addon-actions/decorator';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
};

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Button } from './Button';

import { withActions } from '@storybook/addon-actions/decorator';

export default {
  component: Button,
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

import { withActions } from '@storybook/addon-actions/decorator';

const meta = preview.meta({
  component: Button,

  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },

  decorators: [withActions],
});
```

```ts filename="Button.stories.ts" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { withActions } from '@storybook/addon-actions/decorator';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { withActions } from '@storybook/addon-actions/decorator';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
});
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { withActions } from '@storybook/addon-actions/decorator';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
};

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { withActions } from '@storybook/addon-actions/decorator';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
});
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { withActions } from '@storybook/addon-actions/decorator';

export default {
  component: 'demo-button',
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

import { withActions } from '@storybook/addon-actions/decorator';

const meta: Meta = {
  component: 'demo-button',
  parameters: {
    actions: {
      handles: ['mouseover', 'click .btn'],
    },
  },
  decorators: [withActions],
};

export default meta;
```
