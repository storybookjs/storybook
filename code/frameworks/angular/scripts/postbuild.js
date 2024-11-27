/**
 * This postbuild fix is needed to add a ts-ignore to the generated public-types.d.ts file. The
 * AngularCore.InputSignal and AngularCore.InputSignalWithTransform types do not exist in Angular
 * versions < 17.2. In these versions, the unresolved types will error and prevent Storybook from
 * starting/building. This postbuild script adds a ts-ignore statement above the unresolved types to
 * prevent the errors.
 */

const fs = require('fs');
const path = require('path');

[
  'builders/builders.json',
  'builders/start-storybook/schema.json',
  'builders/build-storybook/schema.json',
].forEach((filePath) => {
  const srcPath = path.join(__dirname, `../src/${filePath}`);
  const distPath = path.join(__dirname, `../dist/${filePath}`);

  fs.copyFileSync(srcPath, distPath);
});
