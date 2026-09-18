```ts renderer="common" language="ts"
import { TransformOptions } from '@babel/core';

export function babelDefault(config: TransformOptions) {
  return {
    plugins: [[import.meta.resolve('@babel/plugin-transform-react-jsx'), {}, 'preset']],
  };
}
```
