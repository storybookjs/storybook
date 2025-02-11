```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { initialize } from '../lib/your-library';

initialize();

const preview = {
  // ...
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { initialize } from '../lib/your-library';

initialize();

export default definePreview({
  // ...
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-renderer';

import { initialize } from '../lib/your-library';

initialize();

const preview: Preview = {
  // ...
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { initialize } from '../lib/your-library';

initialize();

export default definePreview({
  // ...
});
```
