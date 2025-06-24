```js filename="./snapshot-resolver.js" renderer="common" language="js"
import path from 'path';

export default {
  resolveSnapshotPath: (testPath) => {
    const fileName = path.basename(testPath);
    const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');
    // Defines the file extension for the snapshot file
    const modifiedFileName = `${fileNameWithoutExtension}.snap`;

    // Configure Jest to generate snapshot files using the following convention (./src/test/__snapshots__/Button.stories.snap)
    return path.join('./src/test/__snapshots__', modifiedFileName);
  },
  resolveTestPath: (snapshotFilePath, snapshotExtension) =>
    path.basename(snapshotFilePath, snapshotExtension),
  testPathForConsistencyCheck: 'example',
};
```
