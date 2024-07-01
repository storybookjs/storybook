```js filename="example-addon/src/preview.js" renderer="common" language="js"
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

```ts filename="example-addon/src/preview.ts" renderer="common" language="ts"
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

