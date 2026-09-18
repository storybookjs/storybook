```ts filename=".storybook/preview.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, vue3-vite, sveltekit)
import type { Preview } from '@storybook/your-framework';
import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock(import('../lib/session.ts'), { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock(import('uuid'), { spy: true });

const preview: Preview = {
  // ...
};

export default preview;
```

```js filename=".storybook/preview.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock('../lib/session.js', { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock('uuid', { spy: true });

export default {
  // ...
};
```

```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock(import('../lib/session.ts'), { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock(import('uuid'), { spy: true });

export default definePreview({
  // ...
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock('../lib/session.js', { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock('uuid', { spy: true });

export default definePreview({
  // ...
});
```

```ts filename=".storybook/preview.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock(import('../lib/session.ts'), { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock(import('uuid'), { spy: true });

export default definePreview({
  // ...
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock('../lib/session.js', { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock('uuid', { spy: true });

export default definePreview({
  // ...
});
```

```ts filename=".storybook/preview.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';

import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock(import('../lib/session.ts'), { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock(import('uuid'), { spy: true });

export default definePreview({
  // ...
});
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock(import('../lib/session.ts'), { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock(import('uuid'), { spy: true });

export default definePreview({
  // ...
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock('../lib/session.js', { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock('uuid', { spy: true });

export default definePreview({
  // ...
});
```
