```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import '../src/styles/global.css';

export default {
  parameters: {},
};
```

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import '../src/styles/global.css';

export default definePreview({
  parameters: {},
});
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import '../src/styles/global.css';

const preview: Preview = {
  parameters: {},
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import '../src/styles/global.css';

export default definePreview({
  parameters: {},
});
```
