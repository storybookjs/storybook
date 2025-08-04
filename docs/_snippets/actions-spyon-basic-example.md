```ts filename=".storybook/preview.ts" renderer="common" language="ts"
import { spyOn } from 'storybook/test';

export const beforeEach = async () => {
  spyOn(console, 'log').mockName('console.log');
}
```

```js filename=".storybook/preview.js" renderer="common" language="js"
import { spyOn } from 'storybook/test';

export const beforeEach = async () => {
  spyOn(console, 'log').mockName('console.log');
}
```
