```js filename="my-preset/index.js" renderer="common" language="js"
function managerEntries(entry = []) {
  return [...entry, import.meta.resolve('my-other-addon/manager')];
}

const previewAnnotations = (entry = [], options) => {
  return [...entry, import.meta.resolve('my-other-addon/preview')];
};

export default {
  managerEntries,
  previewAnnotations,
};
```
