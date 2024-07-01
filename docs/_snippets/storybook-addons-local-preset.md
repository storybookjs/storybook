```js filename="example-addon/src/preset.js" renderer="common" language="js"
import { webpackFinal as webpack } from './webpack/webpackFinal';
import { viteFinal as vite } from './vite/viteFinal';
import { babelDefault as babel } from './babel/babelDefault';

export const webpackFinal = webpack;
export const viteFinal = vite;
export const babelDefault = babel;
```

```ts filename="example-addon/src/preset.ts" renderer="common" language="ts"
import { webpackFinal as webpack } from './webpack/webpackFinal';

import { viteFinal as vite } from './vite/viteFinal';

import { babelDefault as babel } from './babel/babelDefault';

export const webpackFinal = webpack as any;

export const viteFinal = vite as any;

export const babelDefault = babel as any;
```

