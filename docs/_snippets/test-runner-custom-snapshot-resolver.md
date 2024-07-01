```js filename="./snapshot-resolver.js" renderer="common" language="js"
import path from 'path';

export default {
  resolveSnapshotPath: (testPath) => {
    const fileName = path.basename(testPath);
    const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');
    const modifiedFileName = `${fileNameWithoutExtension}.storyshot`;

    // Configure Jest to generate snapshot files using the following naming convention (__snapshots__/Button.storyshot)
    return path.join(path.dirname(testPath), '__snapshots__', modifiedFileName);
  },
  resolveTestPath: (snapshotFilePath, snapshotExtension) =>
    path.basename(snapshotFilePath, snapshotExtension),
  testPathForConsistencyCheck: 'example.storyshot',
};
```

