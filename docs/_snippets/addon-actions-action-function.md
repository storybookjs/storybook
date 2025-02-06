```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { action } from '@storybook/addon-actions';

import Button from './button.component';

const meta: Meta<Button> = {
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
};

export default meta;
```

```js filename="Button.stories.js" renderer="common" language="js" tabTitle="CSF 3"
import { action } from '@storybook/addon-actions';

import Button from './Button';

export default {
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
};
```

```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { action } from '@storybook/addon-actions';

import Button from './Button';

const meta = preview.meta({
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```ts filename="Button.stories.ts" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { action } from '@storybook/addon-actions';

import Button from './Button';

const meta = {
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { action } from '@storybook/addon-actions';

import Button from './Button';

const meta = preview.meta({
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```ts filename="Button.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { action } from '@storybook/addon-actions';

import Button from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
};

export default meta;
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { action } from '@storybook/addon-actions';

import Button from './Button';

const meta = preview.meta({
  component: Button,
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
});
```

```ts filename="Button.stories.js" renderer="web-components" language="js"
import { action } from '@storybook/addon-actions';

export default {
  component: 'demo-button',
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

import { action } from '@storybook/addon-actions';

const meta: Meta = {
  component: 'demo-button',
  args: {
    // 👇 Create an action that appears when the onClick event is fired
    onClick: action('on-click'),
  },
};

export default meta;
```
