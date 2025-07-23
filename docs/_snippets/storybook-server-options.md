```ts filename="vue/src/server/options.ts" renderer="common" language="ts"
import { sync } from 'read-pkg-up';

export default {
  packageJson: sync({ cwd: process.cwd() }).packageJson,
  framework: 'vue',
  frameworkPresets: [import.meta.resolve('./framework-preset-vue.js')],
};
```
