```ts filename=".storybook/preview.ts" renderer="common" language="ts" tabTitle="CSF 3"
import { sb } from 'storybook/test';

// 👇 Replaces imports of this module with imports to `../lib/__mocks__/session.ts`
sb.mock(import('../lib/session.ts'));
// 👇 Replaces imports of this module with imports to `../__mocks__/uuid.ts`
sb.mock(import('uuid'));

// ...rest of the file
```

```js filename=".storybook/preview.js" renderer="common" language="js" tabTitle="CSF 3"
import { sb } from 'storybook/test';

// 👇 Replaces imports of this module with imports to `../lib/__mocks__/session.ts`
sb.mock('../lib/session.js');
// 👇 Replaces imports of this module with imports to `../__mocks__/uuid.ts`
sb.mock('uuid');

// ...rest of the file
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { sb } from 'storybook/test';

// 👇 Replaces imports of this module with imports to `../lib/__mocks__/session.ts`
sb.mock(import('../lib/session.ts'));
// 👇 Replaces imports of this module with imports to `../__mocks__/uuid.ts`
sb.mock(import('uuid'));

// ...rest of the file
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

import { sb } from 'storybook/test';

// 👇 Replaces imports of this module with imports to `../lib/__mocks__/session.ts`
sb.mock('../lib/session.js');
// 👇 Replaces imports of this module with imports to `../__mocks__/uuid.ts`
sb.mock('uuid');

// ...rest of the file
```
