```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
addons.register('my-organisation/my-addon', (api) => {
  const href = api.getUrlState({
    selectedKind: 'kind',
    selectedStory: 'story',
  }).url;
});
```

