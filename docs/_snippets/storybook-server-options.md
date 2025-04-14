```ts filename="vue/src/server/options.ts" renderer="common" language="ts"
import { sync } from 'read-pkg-up';

export default {
  packageJson: sync({ cwd: __dirname }).packageJson,
  framework: 'vue',
  frameworkPresets: [require.resolve('./framework-preset-vue.js')],
};
```
