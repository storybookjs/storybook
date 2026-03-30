```ts filename=".storybook/preview.tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, vue3-vite, sveltekit)
import type { Preview } from '@storybook/your-framework';
import { sb } from 'storybook/test';

// 👇 Automatically replaces all exports from the `lib/session` local module with mock functions
sb.mock(import('../lib/session.ts'));
// 👇 Automatically replaces all exports from the `uuid` package in `node_modules` with mock functions
sb.mock(import('uuid'));

const preview: Preview = {
  // ...
};

export default preview;
```

```js filename=".storybook/preview.jsx" renderer="common" language="js" tabTitle="CSF 3"
import { sb } from 'storybook/test';

// 👇 Automatically replaces all exports from the `lib/session` local module with mock functions
sb.mock('../lib/session.js');
// 👇 Automatically replaces all exports from the `uuid` package in `node_modules` with mock functions
sb.mock('uuid');

export default {
  // ...
};
```

```ts filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { sb } from 'storybook/test';

// 👇 Automatically replaces all exports from the `lib/session` local module with mock functions
sb.mock(import('../lib/session.ts'));
// 👇 Automatically replaces all exports from the `uuid` package in `node_modules` with mock functions
sb.mock(import('uuid'));

export default definePreview({
  // ...
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { sb } from 'storybook/test';

// 👇 Automatically replaces all exports from the `lib/session` local module with mock functions
sb.mock('../lib/session.js');
// 👇 Automatically replaces all exports from the `uuid` package in `node_modules` with mock functions
sb.mock('uuid');

export default definePreview({
  // ...
});
```

```ts filename=".storybook/preview.tsx" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import { sb } from 'storybook/test';

// 👇 Automatically replaces all exports from the `lib/session` local module with mock functions
sb.mock(import('../lib/session.ts'));
// 👇 Automatically replaces all exports from the `uuid` package in `node_modules` with mock functions
sb.mock(import('uuid'));

export default definePreview({
  // ...
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/vue3-vite';

import { sb } from 'storybook/test';

// 👇 Automatically replaces all exports from the `lib/session` local module with mock functions
sb.mock('../lib/session.js');
// 👇 Automatically replaces all exports from the `uuid` package in `node_modules` with mock functions
sb.mock('uuid');

export default definePreview({
  // ...
});
```

```ts filename=".storybook/preview.tsx" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/angular';

import { sb } from 'storybook/test';

// 👇 Automatically replaces all exports from the `lib/session` local module with mock functions
sb.mock(import('../lib/session.ts'));
// 👇 Automatically replaces all exports from the `uuid` package in `node_modules` with mock functions
sb.mock(import('uuid'));

export default definePreview({
  // ...
});
```

```ts filename=".storybook/preview.tsx" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { sb } from 'storybook/test';

// 👇 Automatically replaces all exports from the `lib/session` local module with mock functions
sb.mock(import('../lib/session.ts'));
// 👇 Automatically replaces all exports from the `uuid` package in `node_modules` with mock functions
sb.mock(import('uuid'));

export default definePreview({
  // ...
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.jsx" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { definePreview } from '@storybook/web-components-vite';

import { sb } from 'storybook/test';

// 👇 Automatically replaces all exports from the `lib/session` local module with mock functions
sb.mock('../lib/session.js');
// 👇 Automatically replaces all exports from the `uuid` package in `node_modules` with mock functions
sb.mock('uuid');

export default definePreview({
  // ...
});
```
