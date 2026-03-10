```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Preview } from '@storybook/your-framework';

import { initialize } from '../lib/your-library';

initialize();

const preview: Preview = {
  // ...
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { initialize } from '../lib/your-library';

initialize();

export default {
  // ...
};
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using, e.g. nextjs, nextjs-vite, react-vite, etc.
import { definePreview } from '@storybook/your-framework';

import { initialize } from '../lib/your-library';

initialize();

const preview = definePreview({
  // ...
});

export default preview;
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using, e.g. nextjs, nextjs-vite, react-vite, etc.
import { definePreview } from '@storybook/your-framework';

import { initialize } from '../lib/your-library';

initialize();

const preview = definePreview({
  // ...
});

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { initialize } from '../lib/your-library';

initialize();

const preview = definePreview({
  // ...
});

export default preview;
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { initialize } from '../lib/your-library';

initialize();

const preview = definePreview({
  // ...
});

export default preview;
```
