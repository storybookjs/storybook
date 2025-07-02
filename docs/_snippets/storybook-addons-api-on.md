```js filename="my-addon/src/manager.js|ts" renderer="common" language="js"
addons.register('my-organisation/my-addon', (api) => {
  // Logs the event data to the browser console whenever the event is emitted.
  api.on('custom-addon-event', (eventData) => console.log(eventData));
});
```
