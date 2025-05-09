```ts filename="vue/src/server/options.ts" renderer="common" language="ts"
import { readFileSync } from 'node:fs';
import * as pkg from 'empathic/package';

export default {
  packageJson: JSON.parse(readFileSync(pkg.up({ cwd: import.meta.dirname }))),
  framework: 'vue',
  frameworkPresets: [require.resolve('./framework-preset-vue.js')],
};
```
