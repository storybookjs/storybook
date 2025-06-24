```js filename="example-addon/preset.js" renderer="common" language="js"
export const previewAnnotations = [require.resolve('./dist/preview')];

export const managerEntries = [require.resolve('./dist/manager')];

export * from './dist/preset';
```
