```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
addons.register('my-organisation/my-addon', (api) => {
  api.getQueryParam('exampleParameter');
});
```
