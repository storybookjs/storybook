```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 4"
// Replace your-framework with the framework you are using, e.g. nextjs, nextjs-vite, react-vite, etc.
import { definePreview } from '@storybook/your-framework';

import { initialize } from '../lib/your-library';

initialize();

const preview = definePreview({
  // ...
});

export default preview;
```

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 4"
// Replace your-framework with the framework you are using, e.g. nextjs, nextjs-vite, react-vite, etc.
import { definePreview } from '@storybook/your-framework';

import { initialize } from '../lib/your-library';

initialize();

const preview = definePreview({
  // ...
});

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { definePreview } from '@storybook/web-components-vite';

import { initialize } from '../lib/your-library';

initialize();

const preview = definePreview({
  // ...
});

export default preview;
```

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { definePreview } from '@storybook/web-components-vite';

import { initialize } from '../lib/your-library';

initialize();

const preview = definePreview({
  // ...
});

export default preview;
```

```ts filename=".storybook/preview.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { initialize } from '../lib/your-library';

initialize();

const preview: Preview = {
  // ...
};

export default preview;
```

```js filename=".storybook/preview.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { initialize } from '../lib/your-library';

initialize();

export default {
  // ...
};
```
