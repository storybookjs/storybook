```ts filename="lib/session.mock.ts" renderer="common" language="ts"
import { fn } from 'storybook/internal/test';
import * as actual from './session';

export * from './session';
export const getUserFromSession = fn(actual.getUserFromSession).mockName('getUserFromSession');
```
