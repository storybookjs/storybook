```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock(import('../lib/session.ts'), { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock(import('uuid'), { spy: true });

// ...rest of the file
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock('../lib/session.js', { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock('uuid', { spy: true });

// ...rest of the file
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock(import('../lib/session.ts'), { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock(import('uuid'), { spy: true });

// ...rest of the file
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock('../lib/session.js', { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock('uuid', { spy: true });

// ...rest of the file
```
