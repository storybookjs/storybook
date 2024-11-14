```js filename="example-addon/src/preview.js" renderer="common" language="js" tabTitle="preset-preview"
import { PARAM_KEY } from './constants';

import { CustomDecorator } from './decorators';

const preview = {
  decorators: [CustomDecorator],
  globals: {
    [PARAM_KEY]: false,
  },
};

export default preview;
```

```js filename="preset.js" renderer="common" language="js" tabTitle="root-preset"
export const previewAnnotations = (entry = [], options) => {
  return [...entry, require.resolve('./dist/preview')];
};
```

```ts filename="example-addon/src/preview.ts" renderer="common" language="ts" tabTitle="preset-preview"
import type { Renderer, ProjectAnnotations } from '@storybook/types';
import { PARAM_KEY } from './constants';
import { CustomDecorator } from './decorators';

const preview: ProjectAnnotations<Renderer> = {
  decorators: [CustomDecorator],
  globals: {
    [PARAM_KEY]: false,
  },
};

export default preview;
```

```js filename="preset.js" renderer="common" language="ts" tabTitle="root-preset"
export const previewAnnotations = (entry = [], options) => {
  return [...entry, require.resolve('./dist/preview')];
};
```
