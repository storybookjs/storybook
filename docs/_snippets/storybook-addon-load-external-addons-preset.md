```js filename="my-preset/index.js" renderer="common" language="js"
function managerEntries(entry = []) {
  return [...entry, require.resolve('my-other-addon/register')];
}

const config = (entry = [], options) => {
  return [...entry, require.resolve('my-other-addon/addDecorator')];
};

export default {
  managerEntries,
  config,
};
```

