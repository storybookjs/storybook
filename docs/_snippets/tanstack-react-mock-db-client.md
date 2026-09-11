```ts filename="src/db/__mocks__/client.ts" renderer="react" language="ts"
import type { drizzle } from 'drizzle-orm/postgres-js';
import type * as schema from '../schema';

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get: () => () => Promise.resolve([]),
});
```
