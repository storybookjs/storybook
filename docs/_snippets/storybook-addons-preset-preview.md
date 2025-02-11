<!-- TODO: Vet this code example for API changes -->

```js filename="example-addon/src/preview.js" renderer="common" language="js" tabTitle="CSF 3"
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

```js filename="example-addon/src/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { PARAM_KEY } from './constants';
import { CustomDecorator } from './decorators';

export default definePreview({
  decorators: [CustomDecorator],
  globals: {
    [PARAM_KEY]: false,
  },
});
```

```ts filename="example-addon/src/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
import type { ProjectAnnotations, Renderer } from '@storybook/types';

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

```ts filename="example-addon/src/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import type { ProjectAnnotations, Renderer } from '@storybook/types';
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { PARAM_KEY } from './constants';
import { CustomDecorator } from './decorators';

export default definePreview({
  decorators: [CustomDecorator],
  globals: {
    [PARAM_KEY]: false,
  },
});
```
