```ts renderer="common" language="ts"
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
