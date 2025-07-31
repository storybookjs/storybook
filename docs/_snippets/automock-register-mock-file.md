```ts filename=".storybook/preview.ts" renderer="common" language="ts"
import { sb } from 'storybook/test';

// 👇 Replaces imports of this module with imports to `../lib/__mocks__/session.ts`
sb.mock(import('../lib/session.ts'));
// 👇 Replaces imports of this module with imports to `../__mocks__/uuid.ts`
sb.mock(import('uuid'));

// ...rest of the file
```

```js filename=".storybook/preview.js" renderer="common" language="js"
import { sb } from 'storybook/test';

// 👇 Replaces imports of this module with imports to `../lib/__mocks__/session.ts`
sb.mock('../lib/session.js');
// 👇 Replaces imports of this module with imports to `../__mocks__/uuid.ts`
sb.mock('uuid');

// ...rest of the file
```
