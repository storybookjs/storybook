```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
addons.register('my-organisation/my-addon', (api) => {
  api.setQueryParams({
    exampleParameter: 'Sets the example parameter value',
    anotherParameter: 'Sets the another parameter value',
  });
});
```

