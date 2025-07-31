```ts filename=".storybook/preview.ts" renderer="common" language="ts"
import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock(import('../lib/session.ts'), { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock(import('uuid'), { spy: true });

// ...rest of the file
```

```js filename=".storybook/preview.js" renderer="common" language="js"
import { sb } from 'storybook/test';

// 👇 Automatically spies on all exports from the `lib/session` local module
sb.mock('../lib/session.ts', { spy: true });
// 👇 Automatically spies on all exports from the `uuid` package in `node_modules`
sb.mock('uuid', { spy: true });

// ...rest of the file
```
