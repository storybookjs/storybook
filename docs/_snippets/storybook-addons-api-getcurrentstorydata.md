```js
addons.register('my-organisation/my-addon', (api) => {
  // Get data about the currently selected story
  const storyData = api.getCurrentStoryData();
  console.log('Current story:', storyData.id, storyData.title);
});
```
