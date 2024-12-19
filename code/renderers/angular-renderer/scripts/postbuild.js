/**
 * This postbuild fix is needed to add a ts-ignore to the generated public-types.d.ts file. The
 * AngularCore.InputSignal and AngularCore.InputSignalWithTransform types do not exist in Angular
 * versions < 17.2. In these versions, the unresolved types will error and prevent Storybook from
 * starting/building. This postbuild script adds a ts-ignore statement above the unresolved types to
 * prevent the errors.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../dist/client/public-types.d.ts');
const fileContent = fs.readFileSync(filePath, 'utf8');
const newContent = fileContent
  .replaceAll(/(type AngularInputSignal)/g, '// @ts-ignore\n$1')
  .replaceAll(/(type AngularOutputEmitterRef)/g, '// @ts-ignore\n$1');
fs.writeFileSync(filePath, newContent, 'utf8');
