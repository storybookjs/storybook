```js filename="example-addon/src/preview.jsx" renderer="react" language="js" tabTitle="CSF 4"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
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

```ts filename="example-addon/src/preview.tsx" renderer="react" language="ts" tabTitle="CSF 4"
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
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

```ts filename="example-addon/src/preview.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
import type { Renderer, ProjectAnnotations } from 'storybook/internal/types';
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

```js filename="example-addon/src/preview.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
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
