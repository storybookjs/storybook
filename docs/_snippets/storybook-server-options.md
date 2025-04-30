```ts filename="vue/src/server/options.ts" renderer="common" language="ts"
import { readFile } from 'node:fs';
import * as pkg from 'empathic/package';

export default {
  packageJson: JSON.parse(readFile(pkg.up({ cwd: process.cwd() }))),
  framework: 'vue',
  frameworkPresets: [import.meta.resolve('./framework-preset-vue.js')],
};
```
