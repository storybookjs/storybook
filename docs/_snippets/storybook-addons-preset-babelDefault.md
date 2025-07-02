```js filename="example-addon/src/babel/babelDefault.js" renderer="common" language="js"
export function babelDefault(config) {
  return {
    ...config,
    plugins: [
      ...config.plugins,
      [require.resolve('@babel/plugin-transform-react-jsx'), {}, 'preset'],
    ],
  };
}
```

```ts filename="example-addon/src/babel/babelDefault.ts" renderer="common" language="ts"
import { TransformOptions } from '@babel/core';

export function babelDefault(config: TransformOptions) {
  return {
    ...config,
    plugins: [
      ...config.plugins,
      [require.resolve('@babel/plugin-transform-react-jsx'), {}, 'preset'],
    ],
  };
}
```
