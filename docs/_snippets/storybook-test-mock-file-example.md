```ts filename="lib/session.mock.ts" renderer="common" language="ts"
import { fn, Mock } from 'storybook/test';
import * as actual from './session';

export * from './session';
export const getUserFromSession: Mock<typeof actual.getUserFromSession> = fn(actual.getUserFromSession).mockName('getUserFromSession');
```
