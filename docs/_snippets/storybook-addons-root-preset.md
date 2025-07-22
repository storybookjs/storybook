```js filename="example-addon/preset.js" renderer="common" language="js"
export const previewAnnotations = [import.meta.resolve('./dist/preview')];

export const managerEntries = [import.meta.resolve('./dist/manager')];

export * from './dist/preset.js';
```
