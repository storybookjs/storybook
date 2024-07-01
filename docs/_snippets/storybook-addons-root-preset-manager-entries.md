```js renderer="common" language="js"
//example-addon/preset.js

export const managerEntries = (entry = []) => {
  return [...entry, require.resolve('path-to-third-party-addon')];
};
```

