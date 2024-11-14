```ts filename="storybook.test.js|ts" renderer="common" language="js"
// ...Code omitted for brevity

describe(options.suite, () => {
  // 👇 Add storyDir in the arguments list
  getAllStoryFiles().forEach(({ filePath, storyFile, storyDir }) => {
    // ...Previously existing code
    describe(title, () => {
      // ...Previously existing code
      stories.forEach(({ name, story }) => {
        // ...Previously existing code
        testFn(name, async () => {
          // ...Previously existing code

          // 👇 Define the path to save the snapshot to:
          const snapshotPath = path.join(
            storyDir,
            options.snapshotsDirName,
            `${componentName}${options.snapshotExtension}`
          );
          expect(mounted.container).toMatchFileSnapshot(snapshotPath);
        });
      });
    });
  });
});
```
