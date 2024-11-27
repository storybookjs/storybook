```js filename="example-addon/preset.js" renderer="common" language="js"
export const managerEntries = (entry = []) => {
  return [...entry, require.resolve('path-to-third-party-addon')];
};
```
