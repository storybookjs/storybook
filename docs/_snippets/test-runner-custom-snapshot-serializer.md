```js filename="./snapshot-serializer.js" renderer="common" language="js"
// The jest-serializer-html package is available as a dependency of the test-runner
const jestSerializerHtml = require('jest-serializer-html');

const DYNAMIC_ID_PATTERN = /"react-aria-\d+(\.\d+)?"/g;

module.exports = {
  /*
   * The test-runner calls the serialize function when the test reaches the expect(SomeHTMLElement).toMatchSnapshot().
   * It will replace all dynamic IDs with a static ID so that the snapshot is consistent.
   * For instance, from <label id="react-aria970235672-:rl:" for="react-aria970235672-:rk:">Favorite color</label> to <label id="react-mocked_id" for="react-mocked_id">Favorite color</label>
   */
  serialize(val) {
    const withFixedIds = val.replace(DYNAMIC_ID_PATTERN, 'mocked_id');
    return jestSerializerHtml.print(withFixedIds);
  },
  test(val) {
    return jestSerializerHtml.test(val);
  },
};
```

